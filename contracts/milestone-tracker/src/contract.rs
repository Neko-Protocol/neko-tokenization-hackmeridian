//! Neko Milestone Tracker.
//!
//! The on-chain record of how far along an issuer is with what they promised:
//! phase one of the building finished, the harvest delivered, the permit
//! granted. The issuer submits evidence, Neko reviews it, and every step is
//! published as an event so the whole history can be read off the ledger.
//!
//! This answers "did they do it?". Whether they *paid* is a separate question,
//! kept in the vault, which is the contract that actually moves money. An
//! issuer can be current on payments and behind on the work, or the other way
//! round, so the two are tracked apart.
//!
//! Nothing here gates anything on chain. It is an append-only log: the backend
//! reads the state and decides what to do with it. That keeps the record
//! impossible to deadlock and leaves the full trail visible in an explorer.
//!
//! No personal data goes on the ledger. Documents live off-chain and only
//! their hash is stored, which is also what Costa Rica's data-protection law
//! requires of the KYC material behind them.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, BytesN, Env, String, Symbol, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;

const MANAGER_ROLE: Symbol = symbol_short!("manager");

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const TTL_EXTEND_TO: u32 = DAY_IN_LEDGERS * 90;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TrackerError {
    /// A vault with that id is already registered.
    VaultExists = 1,
    /// No vault with that id.
    UnknownVault = 2,
    /// No milestone with that index on this tracked.
    UnknownMilestone = 3,
    /// The milestone is not in a status that allows this transition.
    WrongStatus = 4,
    /// A vault needs at least one milestone.
    NoMilestones = 5,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    /// Waiting on the issuer.
    Pending,
    /// Evidence is in, waiting on Neko's review.
    Submitted,
    /// Neko accepted the evidence.
    Approved,
    /// Neko turned it back; the issuer can submit again.
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub index: u32,
    pub title: String,
    /// Hash of the supporting document. All zeroes until something is
    /// submitted; the document itself never touches the ledger.
    pub evidence_hash: BytesN<32>,
    pub evidence_uri: String,
    pub status: MilestoneStatus,
    pub updated_at: u64,
    pub updated_by: Address,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TrackedVault {
    pub vault_id: BytesN<32>,
    pub token: Address,
    pub issuer: Address,
    pub count: u32,
}

#[contracttype]
pub enum DataKey {
    Vault(BytesN<32>),
    Milestone(BytesN<32>, u32),
}

#[contractevent]
pub struct VaultRegistered {
    #[topic]
    pub vault_id: BytesN<32>,
    #[topic]
    pub issuer: Address,
    pub milestones: u32,
}

#[contractevent]
pub struct MilestoneSubmitted {
    #[topic]
    pub vault_id: BytesN<32>,
    #[topic]
    pub milestone: u32,
    pub evidence_hash: BytesN<32>,
    pub evidence_uri: String,
}

#[contractevent]
pub struct MilestoneReviewed {
    #[topic]
    pub vault_id: BytesN<32>,
    #[topic]
    pub milestone: u32,
    pub status: MilestoneStatus,
    /// Hash of the reviewer's note, so a rejection can be justified without
    /// publishing the reasoning.
    pub note_hash: BytesN<32>,
}

#[contract]
pub struct MilestoneTrackerContract;

#[contractimpl]
impl MilestoneTrackerContract {
    pub fn __constructor(e: &Env, admin: Address, manager: Address) {
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);
    }

    /// Open the record for a vault with the milestones its issuer committed to.
    #[only_role(operator, "manager")]
    pub fn register_vault(
        e: &Env,
        vault_id: BytesN<32>,
        token: Address,
        issuer: Address,
        titles: Vec<String>,
        operator: Address,
    ) {
        if e.storage()
            .persistent()
            .has(&DataKey::Vault(vault_id.clone()))
        {
            panic_with_error!(e, TrackerError::VaultExists);
        }
        if titles.is_empty() {
            panic_with_error!(e, TrackerError::NoMilestones);
        }

        let count = titles.len();
        for (index, title) in titles.iter().enumerate() {
            write_milestone(
                e,
                &vault_id,
                &Milestone {
                    index: index as u32,
                    title,
                    evidence_hash: BytesN::from_array(e, &[0u8; 32]),
                    evidence_uri: String::from_str(e, ""),
                    status: MilestoneStatus::Pending,
                    updated_at: e.ledger().timestamp(),
                    updated_by: issuer.clone(),
                },
            );
        }

        write_vault(
            e,
            &TrackedVault {
                vault_id: vault_id.clone(),
                token,
                issuer: issuer.clone(),
                count,
            },
        );

        VaultRegistered {
            vault_id,
            issuer,
            milestones: count,
        }
        .publish(e);
    }

    /// Put forward the evidence that a milestone is done.
    ///
    /// Allowed from `Pending` and from `Rejected`, so an issuer can answer a
    /// knock-back with better paperwork.
    pub fn submit_milestone(
        e: &Env,
        vault_id: BytesN<32>,
        index: u32,
        evidence_hash: BytesN<32>,
        evidence_uri: String,
    ) {
        let tracked = vault(e, &vault_id);
        tracked.issuer.require_auth();

        let mut milestone = milestone(e, &vault_id, index);
        if !matches!(
            milestone.status,
            MilestoneStatus::Pending | MilestoneStatus::Rejected
        ) {
            panic_with_error!(e, TrackerError::WrongStatus);
        }

        milestone.evidence_hash = evidence_hash.clone();
        milestone.evidence_uri = evidence_uri.clone();
        milestone.status = MilestoneStatus::Submitted;
        milestone.updated_at = e.ledger().timestamp();
        milestone.updated_by = tracked.issuer;
        write_milestone(e, &vault_id, &milestone);

        MilestoneSubmitted {
            vault_id,
            milestone: index,
            evidence_hash,
            evidence_uri,
        }
        .publish(e);
    }

    /// Accept or turn back submitted evidence.
    #[only_role(operator, "manager")]
    pub fn review_milestone(
        e: &Env,
        vault_id: BytesN<32>,
        index: u32,
        approved: bool,
        note_hash: BytesN<32>,
        operator: Address,
    ) {
        let mut milestone = milestone(e, &vault_id, index);
        if milestone.status != MilestoneStatus::Submitted {
            panic_with_error!(e, TrackerError::WrongStatus);
        }

        let status = if approved {
            MilestoneStatus::Approved
        } else {
            MilestoneStatus::Rejected
        };
        milestone.status = status;
        milestone.updated_at = e.ledger().timestamp();
        milestone.updated_by = operator;
        write_milestone(e, &vault_id, &milestone);

        MilestoneReviewed {
            vault_id,
            milestone: index,
            status,
            note_hash,
        }
        .publish(e);
    }

    // ------------------------------------------------------------------- Views

    pub fn get_vault(e: &Env, vault_id: BytesN<32>) -> TrackedVault {
        vault(e, &vault_id)
    }

    pub fn get_milestone(e: &Env, vault_id: BytesN<32>, index: u32) -> Milestone {
        milestone(e, &vault_id, index)
    }

    pub fn list_milestones(e: &Env, vault_id: BytesN<32>) -> Vec<Milestone> {
        let tracked = vault(e, &vault_id);
        let mut out = Vec::new(e);
        for index in 0..tracked.count {
            out.push_back(milestone(e, &vault_id, index));
        }
        out
    }

    /// How many of a vault's milestones Neko has approved, for a progress bar
    /// that does not have to trust the backend.
    pub fn approved_count(e: &Env, vault_id: BytesN<32>) -> u32 {
        let tracked = vault(e, &vault_id);
        let mut approved = 0;
        for index in 0..tracked.count {
            if milestone(e, &vault_id, index).status == MilestoneStatus::Approved {
                approved += 1;
            }
        }
        approved
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for MilestoneTrackerContract {}

// ------------------------------------------------------------------- Internals

fn vault(e: &Env, vault_id: &BytesN<32>) -> TrackedVault {
    let key = DataKey::Vault(vault_id.clone());
    match e.storage().persistent().get::<_, TrackedVault>(&key) {
        Some(tracked) => {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            tracked
        }
        None => panic_with_error!(e, TrackerError::UnknownVault),
    }
}

fn write_vault(e: &Env, tracked: &TrackedVault) {
    let key = DataKey::Vault(tracked.vault_id.clone());
    e.storage().persistent().set(&key, tracked);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn milestone(e: &Env, vault_id: &BytesN<32>, index: u32) -> Milestone {
    let key = DataKey::Milestone(vault_id.clone(), index);
    match e.storage().persistent().get::<_, Milestone>(&key) {
        Some(milestone) => {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            milestone
        }
        None => panic_with_error!(e, TrackerError::UnknownMilestone),
    }
}

fn write_milestone(e: &Env, vault_id: &BytesN<32>, milestone: &Milestone) {
    let key = DataKey::Milestone(vault_id.clone(), milestone.index);
    e.storage().persistent().set(&key, milestone);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
