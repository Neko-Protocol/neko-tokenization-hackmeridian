extern crate std;

use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger as _},
    vec, Address, BytesN, Env, String, Symbol, Vec,
};

use crate::contract::{
    FactoryContract, FactoryContractClient, FactoryError, Templates, TrancheInit, VaultRequest,
    VaultTerms,
};

// The real artifacts, so these tests exercise the same deploys that run on
// testnet — including whether three of them fit in one transaction.
mod token_wasm {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/rwa_token_example.wasm");
}
mod compliance_wasm {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/rwa_compliance_example.wasm"
    );
}
mod vault_wasm {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/neko_vault.wasm");
}
/// Only the bytes are needed: these are registered, never called through a
/// generated client.
const REGISTRY_WASM: &[u8] =
    include_bytes!("../../target/wasm32v1-none/release/rwa_identity_registry_example.wasm");
/// Only the bytes are needed: these are registered, never called through a
/// generated client.
const TOPICS_WASM: &[u8] =
    include_bytes!("../../target/wasm32v1-none/release/rwa_claim_topics_and_issuers_example.wasm");
/// Only the bytes are needed: these are registered, never called through a
/// generated client.
const VERIFIER_WASM: &[u8] =
    include_bytes!("../../target/wasm32v1-none/release/rwa_identity_verifier_example.wasm");

struct Platform<'a> {
    e: Env,
    factory: FactoryContractClient<'a>,
    admin: Address,
    manager: Address,
    identity_registry: Address,
}

/// Stand up the shared identity stack and the factory, exactly as
/// `deploy-shared.sh` does on testnet.
fn setup() -> Platform<'static> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 1_700_000_000);
    // Left on: whether a three-contract deploy fits a real transaction is
    // exactly what these tests need to answer.

    let admin = Address::generate(&e);
    let manager = Address::generate(&e);

    let topics = e.register(TOPICS_WASM, (admin.clone(), admin.clone()));
    let identity_registry = e.register(REGISTRY_WASM, (admin.clone(), admin.clone()));
    let identity_verifier = e.register(
        VERIFIER_WASM,
        (
            admin.clone(),
            admin.clone(),
            identity_registry.clone(),
            topics.clone(),
        ),
    );

    let templates = Templates {
        token_wasm_hash: e.deployer().upload_contract_wasm(token_wasm::WASM),
        compliance_wasm_hash: e.deployer().upload_contract_wasm(compliance_wasm::WASM),
        vault_wasm_hash: e.deployer().upload_contract_wasm(vault_wasm::WASM),
        identity_verifier,
        identity_registry: identity_registry.clone(),
        platform_admin: admin.clone(),
        platform_manager: manager.clone(),
    };

    let factory = e.register(FactoryContract, (admin.clone(), manager.clone(), templates));

    Platform {
        factory: FactoryContractClient::new(&e, &factory),
        e,
        admin,
        manager,
        identity_registry,
    }
}

fn request(p: &Platform, vault_id: &BytesN<32>) -> VaultRequest {
    VaultRequest {
        vault_id: vault_id.clone(),
        issuer: Address::generate(&p.e),
        name: String::from_str(&p.e, "Casa Escazu"),
        symbol: String::from_str(&p.e, "CASA"),
        metadata_hash: BytesN::random(&p.e),
        metadata_uri: String::from_str(&p.e, "ipfs://prospectus"),
    }
}

/// The commercial terms the factory turns into a vault.
fn terms(p: &Platform) -> VaultTerms {
    VaultTerms {
        usdc: p
            .e
            .register_stellar_asset_contract_v2(p.admin.clone())
            .address(),
        borrower: Address::generate(&p.e),
        target: 100_000,
        min_target: 50_000,
        expected_repayment: 113_000,
        funding_deadline: u64::MAX,
        exit_fee_bps: 500,
        max_exit_fee_bps: 1_000,
        fee_recipient: p.admin.clone(),
    }
}

fn tranches(e: &Env) -> Vec<TrancheInit> {
    vec![
        e,
        TrancheInit {
            expected_amount: 113_000,
            due_date: 1,
        },
    ]
}

#[test]
fn create_vault_deploys_three_contracts_and_records_them() {
    let p = setup();
    let vault_id = BytesN::random(&p.e);

    let deployment = p.factory.create_vault(
        &request(&p, &vault_id),
        &terms(&p),
        &tranches(&p.e),
        &p.manager,
    );

    // Three distinct contracts, all derived from the one vault id.
    assert_ne!(deployment.token, deployment.compliance);
    assert_ne!(deployment.token, deployment.vault);
    assert_ne!(deployment.compliance, deployment.vault);
    assert!(!deployment.wired);

    // The token really is a live SEP-57 token.
    let token = token_wasm::Client::new(&p.e, &deployment.token);
    assert_eq!(token.name(), String::from_str(&p.e, "Casa Escazu"));
    assert_eq!(token.symbol(), String::from_str(&p.e, "CASA"));
    assert_eq!(token.total_supply(), 0);

    // The vault was handed the token the factory just made, not whatever the
    // caller might have named.
    assert_eq!(
        vault_wasm::Client::new(&p.e, &deployment.vault)
            .get_config()
            .token,
        deployment.token
    );

    // Nothing the factory deploys stays the factory's. The vault and the
    // compliance contract belong to the platform from the start.
    assert_eq!(
        vault_wasm::Client::new(&p.e, &deployment.vault).get_admin(),
        Some(p.admin.clone())
    );
    assert_eq!(
        compliance_wasm::Client::new(&p.e, &deployment.compliance).get_admin(),
        Some(p.admin.clone())
    );

    // And the registry can be read back without an indexer.
    assert_eq!(p.factory.deployment_count(), 1);
    assert_eq!(p.factory.get_deployment(&vault_id).token, deployment.token);
    assert_eq!(p.factory.list_deployments(&0, &10).len(), 1);
}

/// The factory publishes the shared registry's address even though it never
/// calls it, so a front end can find the platform's identity stack from the
/// one contract it already knows.
#[test]
fn templates_publish_the_shared_stack() {
    let p = setup();
    assert_eq!(
        p.factory.get_templates().identity_registry,
        p.identity_registry
    );
}

/// Binding the token to its compliance contract and to the shared registry is
/// the platform manager's job, not the factory's — see the note at the top of
/// `contract.rs`.
#[test]
fn wire_vault_empowers_the_vault_and_hands_the_token_over() {
    let p = setup();
    let vault_id = BytesN::random(&p.e);
    let deployment = p.factory.create_vault(
        &request(&p, &vault_id),
        &terms(&p),
        &tranches(&p.e),
        &p.manager,
    );

    p.factory.wire_vault(&vault_id, &p.manager);

    assert!(p.factory.get_deployment(&vault_id).wired);

    // The vault can mint, which is what makes `invest` work.
    let token = token_wasm::Client::new(&p.e, &deployment.token);
    assert!(token
        .has_role(&deployment.vault, &Symbol::new(&p.e, "manager"))
        .is_some());

    // The factory has offered the admin role on and holds it only until the
    // platform accepts.
    assert_eq!(token.get_admin(), Some(p.factory.address.clone()));
    token.accept_admin_transfer();
    assert_eq!(token.get_admin(), Some(p.admin.clone()));
}

#[test]
fn a_vault_id_is_used_once() {
    let p = setup();
    let vault_id = BytesN::random(&p.e);
    p.factory.create_vault(
        &request(&p, &vault_id),
        &terms(&p),
        &tranches(&p.e),
        &p.manager,
    );

    assert_eq!(
        p.factory
            .try_create_vault(
                &request(&p, &vault_id),
                &terms(&p),
                &tranches(&p.e),
                &p.manager
            )
            .unwrap_err()
            .unwrap(),
        FactoryError::VaultExists.into()
    );
}

#[test]
fn wiring_happens_once() {
    let p = setup();
    let vault_id = BytesN::random(&p.e);
    p.factory.create_vault(
        &request(&p, &vault_id),
        &terms(&p),
        &tranches(&p.e),
        &p.manager,
    );
    p.factory.wire_vault(&vault_id, &p.manager);

    assert_eq!(
        p.factory
            .try_wire_vault(&vault_id, &p.manager)
            .unwrap_err()
            .unwrap(),
        FactoryError::AlreadyWired.into()
    );
}

#[test]
fn unknown_vaults_are_rejected() {
    let p = setup();
    assert_eq!(
        p.factory
            .try_get_deployment(&BytesN::random(&p.e))
            .unwrap_err()
            .unwrap(),
        FactoryError::UnknownVault.into()
    );
}

#[test]
fn the_registry_survives_a_template_change() {
    let p = setup();
    let vault_id = BytesN::random(&p.e);
    p.factory.create_vault(
        &request(&p, &vault_id),
        &terms(&p),
        &tranches(&p.e),
        &p.manager,
    );

    let mut templates = p.factory.get_templates();
    templates.vault_wasm_hash = p.e.deployer().upload_contract_wasm(compliance_wasm::WASM);
    p.factory.set_templates(&templates, &p.admin);

    assert_eq!(p.factory.deployment_count(), 1);
    assert_eq!(p.factory.get_deployment(&vault_id).vault_id, vault_id);
}

#[test]
fn vaults_page() {
    let p = setup();
    for _ in 0..3 {
        p.factory.create_vault(
            &request(&p, &BytesN::random(&p.e)),
            &terms(&p),
            &tranches(&p.e),
            &p.manager,
        );
    }
    assert_eq!(p.factory.deployment_count(), 3);
    assert_eq!(p.factory.list_deployments(&0, &2).len(), 2);
    assert_eq!(p.factory.list_deployments(&2, &10).len(), 1);
    assert_eq!(p.factory.list_deployments(&3, &10).len(), 0);
}
