//! Neko Factory.
//!
//! Deploys the three per-vault contracts — the SEP-57 token, its compliance
//! dispatcher and the vault that holds the money — wires them together, and
//! keeps the on-chain registry of every vault Neko has launched.
//!
//! The identity stack (claim topics and issuers, claim issuer, identity
//! registry, identity verifier) is deployed once for the whole platform and
//! shared by every vault, so an investor passes KYC once and can then take part
//! in any of them.
//!
//! Deployment is split in two calls on purpose. `create_vault` does the three
//! deploys and records the vault; `wire_vault` binds the token to its compliance
//! contract and grants the vault the role it needs to mint. Doing all of it in
//! one transaction risks running past the ledger's CPU and footprint budget,
//! and splitting it keeps each call comfortably inside.
//!
//! The factory owns nothing for long. The compliance contract and the vault go
//! straight into the platform's hands, and the factory takes
//! the token's admin role only so that `wire_vault` can grant the vault its
//! minting rights before handing the role on.
//!
//! Binding tokens to their compliance contract and to the shared identity
//! registry is left to the platform manager, which already holds the role on
//! both. The registry in particular does not implement `AccessControl`, so the
//! manager role it is deployed with can never be transferred — making the
//! factory that manager would leave the platform unable to bind a token any
//! other way.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, Address, BytesN, ContractExecutable, Env, IntoVal, String,
    Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::{only_admin, only_role};

const MANAGER_ROLE: Symbol = symbol_short!("manager");

const DAY_IN_LEDGERS: u32 = 17_280;
/// How long the platform admin has to accept a token's admin role.
const ADMIN_HANDOVER_LEDGERS: u32 = DAY_IN_LEDGERS * 7;
const TTL_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const TTL_EXTEND_TO: u32 = DAY_IN_LEDGERS * 90;

/// The slice of `stellar_access::access_control` the factory calls on the
/// freshly deployed token: let the vault mint and burn, then hand the token's
/// administration over to the platform and step out of the way.
#[contractclient(name = "TokenAdminClient")]
pub trait TokenAdminInterface {
    fn grant_role(e: Env, account: Address, role: Symbol, caller: Address);
    fn transfer_admin_role(e: Env, new_admin: Address, live_until_ledger: u32);
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FactoryError {
    /// A vault with that id already exists.
    VaultExists = 1,
    /// No vault with that id.
    UnknownVault = 2,
    /// The vault's contracts have already been wired.
    AlreadyWired = 3,
}

/// One launched vault and the three contracts that make it up.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Deployment {
    pub vault_id: BytesN<32>,
    pub issuer: Address,
    pub token: Address,
    pub compliance: Address,
    pub vault: Address,
    /// Hash of the off-chain form and prospectus, so the paperwork behind the
    /// vault can be proven unchanged without putting any of it on the ledger.
    pub metadata_hash: BytesN<32>,
    pub metadata_uri: String,
    pub created_at: u64,
    pub wired: bool,
}

/// The vault's own `Config`, mirrored here.
///
/// A `#[contracttype]` struct serialises as a map keyed by field name, so a
/// structurally identical struct converts to exactly what the vault's
/// constructor expects. The factory's tests deploy the real vault wasm, so if
/// the two ever drift apart they fail at once.
#[contracttype]
#[derive(Clone, Debug)]
pub struct VaultConfig {
    pub token: Address,
    pub usdc: Address,
    pub borrower: Address,
    pub target: i128,
    pub min_target: i128,
    pub expected_repayment: i128,
    pub funding_deadline: u64,
    pub max_exit_fee_bps: u32,
    pub fee_recipient: Address,
}

/// The commercial terms of a vault.
///
/// There is no `token` here on purpose: the token does not exist when the
/// caller builds this, and the factory fills it in with the one it deploys.
/// Letting a caller name the token would make it possible to point a vault at
/// the wrong one.
#[contracttype]
#[derive(Clone, Debug)]
pub struct VaultTerms {
    pub usdc: Address,
    pub borrower: Address,
    pub target: i128,
    pub min_target: i128,
    /// Principal plus interest. The rate is applied off-chain, once.
    pub expected_repayment: i128,
    pub funding_deadline: u64,
    pub exit_fee_bps: u32,
    pub max_exit_fee_bps: u32,
    pub fee_recipient: Address,
}

/// One scheduled repayment, as the vault's constructor takes it.
#[contracttype]
#[derive(Clone, Debug)]
pub struct TrancheInit {
    pub expected_amount: i128,
    pub due_date: u64,
}

/// What a caller has to supply to launch a vault. Grouped into a struct because
/// a flat argument list would be long enough to be easy to misorder.
#[contracttype]
#[derive(Clone, Debug)]
pub struct VaultRequest {
    pub vault_id: BytesN<32>,
    pub issuer: Address,
    pub name: String,
    pub symbol: String,
    pub metadata_hash: BytesN<32>,
    pub metadata_uri: String,
}

/// The templates and shared contracts every vault is built from.
#[contracttype]
#[derive(Clone)]
pub struct Templates {
    pub token_wasm_hash: BytesN<32>,
    pub compliance_wasm_hash: BytesN<32>,
    pub vault_wasm_hash: BytesN<32>,
    pub identity_verifier: Address,
    /// Published so a front end can find the shared registry from the factory.
    /// The factory itself never calls it; see the note at the top of the file.
    pub identity_registry: Address,
    /// Who ends up owning each vault's contracts. The factory is never a
    /// lasting owner of anything it deploys: it holds the token's admin role
    /// only long enough to empower the vault, then hands it over.
    pub platform_admin: Address,
    pub platform_manager: Address,
}

#[contracttype]
pub enum DataKey {
    Templates,
    DeploymentCount,
    Deployment(BytesN<32>),
    DeploymentByIndex(u32),
}

#[contractevent]
pub struct VaultCreated {
    #[topic]
    pub vault_id: BytesN<32>,
    #[topic]
    pub issuer: Address,
    pub token: Address,
    pub compliance: Address,
    pub vault: Address,
}

#[contractevent]
pub struct VaultWired {
    #[topic]
    pub vault_id: BytesN<32>,
    pub token: Address,
}

#[contractevent]
pub struct TemplatesChanged {
    pub token_wasm_hash: BytesN<32>,
    pub compliance_wasm_hash: BytesN<32>,
    pub vault_wasm_hash: BytesN<32>,
}

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    pub fn __constructor(e: &Env, admin: Address, manager: Address, templates: Templates) {
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);
        e.storage().instance().set(&DataKey::Templates, &templates);
        e.storage().instance().set(&DataKey::DeploymentCount, &0u32);
    }

    /// Deploy a vault's token, compliance contract and vault, and record it.
    ///
    /// The three addresses are derived from `vault_id`, so the backend can work
    /// out where each contract will live before the transaction is sent.
    #[only_role(operator, "manager")]
    pub fn create_vault(
        e: &Env,
        request: VaultRequest,
        terms: VaultTerms,
        tranches: Vec<TrancheInit>,
        operator: Address,
    ) -> Deployment {
        let key = DataKey::Deployment(request.vault_id.clone());
        if e.storage().persistent().has(&key) {
            panic_with_error!(e, FactoryError::VaultExists);
        }

        let templates: Templates = e.storage().instance().get(&DataKey::Templates).unwrap();
        let factory = e.current_contract_address();

        // The compliance contract comes first: the token's constructor takes
        // its address. It belongs to the platform from the start — the factory
        // never calls it, so it needs no role on it.
        let compliance = deploy(
            e,
            &templates.compliance_wasm_hash,
            &request.vault_id,
            0,
            (
                templates.platform_admin.clone(),
                templates.platform_manager.clone(),
            )
                .into_val(e),
        );

        let token = deploy(
            e,
            &templates.token_wasm_hash,
            &request.vault_id,
            1,
            // The factory takes the admin role only so that `wire_vault` can
            // grant the vault its minting rights; it hands the role on in the
            // same call. The manager role goes straight to the platform.
            (
                request.name.clone(),
                request.symbol.clone(),
                factory.clone(),
                templates.platform_manager.clone(),
                compliance.clone(),
                templates.identity_verifier.clone(),
            )
                .into_val(e),
        );

        // The vault learns which token it serves from the one just deployed,
        // never from the caller.
        let config = VaultConfig {
            token: token.clone(),
            usdc: terms.usdc,
            borrower: terms.borrower,
            target: terms.target,
            min_target: terms.min_target,
            expected_repayment: terms.expected_repayment,
            funding_deadline: terms.funding_deadline,
            max_exit_fee_bps: terms.max_exit_fee_bps,
            fee_recipient: terms.fee_recipient,
        };
        let vault = deploy(
            e,
            &templates.vault_wasm_hash,
            &request.vault_id,
            2,
            (
                templates.platform_admin.clone(),
                templates.platform_manager.clone(),
                config,
                terms.exit_fee_bps,
                tranches,
            )
                .into_val(e),
        );

        let deployment = Deployment {
            vault_id: request.vault_id.clone(),
            issuer: request.issuer.clone(),
            token: token.clone(),
            compliance: compliance.clone(),
            vault: vault.clone(),
            metadata_hash: request.metadata_hash.clone(),
            metadata_uri: request.metadata_uri.clone(),
            created_at: e.ledger().timestamp(),
            wired: false,
        };
        write_deployment(e, &deployment);

        let index: u32 = e
            .storage()
            .instance()
            .get(&DataKey::DeploymentCount)
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&DataKey::DeploymentByIndex(index), &request.vault_id);
        e.storage()
            .instance()
            .set(&DataKey::DeploymentCount, &(index + 1));

        VaultCreated {
            vault_id: request.vault_id,
            issuer: request.issuer,
            token,
            compliance,
            vault,
        }
        .publish(e);

        deployment
    }

    /// Grant the vault the `manager` role on the token, so it can mint on
    /// `invest` and burn on `redeem`, then offer the token's admin role to the
    /// platform.
    ///
    /// The handover is the two-step one `stellar_access` provides: the platform
    /// admin has to call `accept_admin_transfer` on the token to complete it.
    /// Until they do, the factory still holds the role, so a wrong address
    /// cannot strand the token.
    ///
    /// Separate from `create_vault` to keep both calls inside the per-transaction
    /// resource budget.
    #[only_role(operator, "manager")]
    pub fn wire_vault(e: &Env, vault_id: BytesN<32>, operator: Address) {
        let mut deployment = deployment(e, &vault_id);
        if deployment.wired {
            panic_with_error!(e, FactoryError::AlreadyWired);
        }

        let templates: Templates = e.storage().instance().get(&DataKey::Templates).unwrap();
        let factory = e.current_contract_address();
        let token = TokenAdminClient::new(e, &deployment.token);

        token.grant_role(&deployment.vault, &MANAGER_ROLE, &factory);
        token.transfer_admin_role(
            &templates.platform_admin,
            &(e.ledger().sequence() + ADMIN_HANDOVER_LEDGERS),
        );

        deployment.wired = true;
        write_deployment(e, &deployment);

        VaultWired {
            vault_id,
            token: deployment.token,
        }
        .publish(e);
    }

    /// Point new vaults at different contract templates, without having to
    /// redeploy the factory or lose the registry.
    #[only_admin]
    pub fn set_templates(e: &Env, templates: Templates, _caller: Address) {
        e.storage().instance().set(&DataKey::Templates, &templates);
        TemplatesChanged {
            token_wasm_hash: templates.token_wasm_hash,
            compliance_wasm_hash: templates.compliance_wasm_hash,
            vault_wasm_hash: templates.vault_wasm_hash,
        }
        .publish(e);
    }

    // ------------------------------------------------------------------- Views

    pub fn get_templates(e: &Env) -> Templates {
        e.storage().instance().get(&DataKey::Templates).unwrap()
    }

    pub fn get_deployment(e: &Env, vault_id: BytesN<32>) -> Deployment {
        deployment(e, &vault_id)
    }

    pub fn deployment_count(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::DeploymentCount)
            .unwrap_or(0)
    }

    /// A page of the registry, so a front end can list every vault without an
    /// indexer standing between it and the ledger.
    pub fn list_deployments(e: &Env, start: u32, limit: u32) -> Vec<Deployment> {
        let count = Self::deployment_count(e);
        let mut out = Vec::new(e);
        let mut index = start;
        while index < count && out.len() < limit {
            let vault_id: BytesN<32> = e
                .storage()
                .persistent()
                .get(&DataKey::DeploymentByIndex(index))
                .unwrap();
            out.push_back(deployment(e, &vault_id));
            index += 1;
        }
        out
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for FactoryContract {}

// ------------------------------------------------------------------- Internals

/// Deploy one contract for a vault.
///
/// The salt mixes the vault id with `slot`, so the three contracts of a vault get
/// three distinct, reproducible addresses from a single id.
fn deploy(
    e: &Env,
    wasm_hash: &BytesN<32>,
    vault_id: &BytesN<32>,
    slot: u8,
    args: Vec<Val>,
) -> Address {
    let mut salt = vault_id.to_array();
    salt[31] ^= slot;
    e.deployer()
        .with_address(e.current_contract_address(), BytesN::from_array(e, &salt))
        .deploy_contract(ContractExecutable::Wasm(wasm_hash.clone()), args)
}

fn deployment(e: &Env, vault_id: &BytesN<32>) -> Deployment {
    let key = DataKey::Deployment(vault_id.clone());
    match e.storage().persistent().get::<_, Deployment>(&key) {
        Some(deployment) => {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            deployment
        }
        None => panic_with_error!(e, FactoryError::UnknownVault),
    }
}

fn write_deployment(e: &Env, deployment: &Deployment) {
    let key = DataKey::Deployment(deployment.vault_id.clone());
    e.storage().persistent().set(&key, deployment);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
