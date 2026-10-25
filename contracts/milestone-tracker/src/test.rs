extern crate std;

use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger as _},
    vec, Address, BytesN, Env, String, Vec,
};

use crate::contract::{
    MilestoneStatus, MilestoneTrackerContract, MilestoneTrackerContractClient, TrackerError,
};

struct Tracker<'a> {
    e: Env,
    client: MilestoneTrackerContractClient<'a>,
    manager: Address,
    issuer: Address,
    vault_id: BytesN<32>,
}

fn titles(e: &Env) -> Vec<String> {
    vec![
        e,
        String::from_str(e, "Permits granted"),
        String::from_str(e, "Structure complete"),
        String::from_str(e, "Handover"),
    ]
}

fn setup() -> Tracker<'static> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 1_700_000_000);

    let admin = Address::generate(&e);
    let manager = Address::generate(&e);
    let issuer = Address::generate(&e);
    let token = Address::generate(&e);
    let vault_id = BytesN::random(&e);

    let address = e.register(MilestoneTrackerContract, (admin, manager.clone()));
    let client = MilestoneTrackerContractClient::new(&e, &address);
    client.register_vault(&vault_id, &token, &issuer, &titles(&e), &manager);

    Tracker {
        client,
        e,
        manager,
        issuer,
        vault_id,
    }
}

fn evidence(e: &Env) -> (BytesN<32>, String) {
    (
        BytesN::random(e),
        String::from_str(e, "ipfs://phase-1-photos"),
    )
}

#[test]
fn a_registered_vault_starts_with_everything_pending() {
    let t = setup();

    let tracked = t.client.get_vault(&t.vault_id);
    assert_eq!(tracked.issuer, t.issuer);
    assert_eq!(tracked.count, 3);

    let milestones = t.client.list_milestones(&t.vault_id);
    assert_eq!(milestones.len(), 3);
    for milestone in milestones.iter() {
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(
            milestone.evidence_hash,
            BytesN::from_array(&t.e, &[0u8; 32])
        );
    }
    assert_eq!(t.client.approved_count(&t.vault_id), 0);
}

#[test]
fn submit_then_approve_walks_the_milestone_forward() {
    let t = setup();
    let (hash, uri) = evidence(&t.e);

    t.client.submit_milestone(&t.vault_id, &0, &hash, &uri);

    let milestone = t.client.get_milestone(&t.vault_id, &0);
    assert_eq!(milestone.status, MilestoneStatus::Submitted);
    assert_eq!(milestone.evidence_hash, hash);
    assert_eq!(milestone.evidence_uri, uri);
    assert_eq!(milestone.updated_by, t.issuer);
    assert_eq!(milestone.updated_at, 1_700_000_000);

    t.client
        .review_milestone(&t.vault_id, &0, &true, &BytesN::random(&t.e), &t.manager);

    let milestone = t.client.get_milestone(&t.vault_id, &0);
    assert_eq!(milestone.status, MilestoneStatus::Approved);
    assert_eq!(milestone.updated_by, t.manager);
    assert_eq!(t.client.approved_count(&t.vault_id), 1);
}

#[test]
fn a_rejected_milestone_can_be_resubmitted() {
    let t = setup();
    let (hash, uri) = evidence(&t.e);

    t.client.submit_milestone(&t.vault_id, &0, &hash, &uri);
    t.client
        .review_milestone(&t.vault_id, &0, &false, &BytesN::random(&t.e), &t.manager);
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &0).status,
        MilestoneStatus::Rejected
    );

    let (better_hash, better_uri) = evidence(&t.e);
    t.client
        .submit_milestone(&t.vault_id, &0, &better_hash, &better_uri);
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &0).status,
        MilestoneStatus::Submitted
    );

    t.client
        .review_milestone(&t.vault_id, &0, &true, &BytesN::random(&t.e), &t.manager);
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &0).status,
        MilestoneStatus::Approved
    );
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &0).evidence_hash,
        better_hash
    );
}

#[test]
fn an_approved_milestone_is_not_submitted_again() {
    let t = setup();
    let (hash, uri) = evidence(&t.e);

    t.client.submit_milestone(&t.vault_id, &0, &hash, &uri);
    t.client
        .review_milestone(&t.vault_id, &0, &true, &BytesN::random(&t.e), &t.manager);

    assert_eq!(
        t.client
            .try_submit_milestone(&t.vault_id, &0, &hash, &uri)
            .unwrap_err()
            .unwrap(),
        TrackerError::WrongStatus.into()
    );
}

#[test]
fn nothing_is_reviewed_before_it_is_submitted() {
    let t = setup();
    assert_eq!(
        t.client
            .try_review_milestone(&t.vault_id, &1, &true, &BytesN::random(&t.e), &t.manager)
            .unwrap_err()
            .unwrap(),
        TrackerError::WrongStatus.into()
    );
}

#[test]
fn milestones_advance_independently() {
    let t = setup();
    let (hash, uri) = evidence(&t.e);

    t.client.submit_milestone(&t.vault_id, &0, &hash, &uri);
    t.client
        .review_milestone(&t.vault_id, &0, &true, &BytesN::random(&t.e), &t.manager);
    t.client.submit_milestone(&t.vault_id, &2, &hash, &uri);

    assert_eq!(
        t.client.get_milestone(&t.vault_id, &0).status,
        MilestoneStatus::Approved
    );
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &1).status,
        MilestoneStatus::Pending
    );
    assert_eq!(
        t.client.get_milestone(&t.vault_id, &2).status,
        MilestoneStatus::Submitted
    );
    assert_eq!(t.client.approved_count(&t.vault_id), 1);
}

#[test]
fn a_vault_is_registered_once() {
    let t = setup();
    assert_eq!(
        t.client
            .try_register_vault(
                &t.vault_id,
                &Address::generate(&t.e),
                &t.issuer,
                &titles(&t.e),
                &t.manager
            )
            .unwrap_err()
            .unwrap(),
        TrackerError::VaultExists.into()
    );
}

#[test]
fn unknown_vaults_and_milestones_are_rejected() {
    let t = setup();
    assert_eq!(
        t.client
            .try_get_vault(&BytesN::random(&t.e))
            .unwrap_err()
            .unwrap(),
        TrackerError::UnknownVault.into()
    );
    assert_eq!(
        t.client
            .try_get_milestone(&t.vault_id, &99)
            .unwrap_err()
            .unwrap(),
        TrackerError::UnknownMilestone.into()
    );
}

#[test]
fn a_vault_needs_at_least_one_milestone() {
    let t = setup();
    assert_eq!(
        t.client
            .try_register_vault(
                &BytesN::random(&t.e),
                &Address::generate(&t.e),
                &t.issuer,
                &Vec::new(&t.e),
                &t.manager
            )
            .unwrap_err()
            .unwrap(),
        TrackerError::NoMilestones.into()
    );
}
