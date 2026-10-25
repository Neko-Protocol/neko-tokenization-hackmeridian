extern crate std;

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    Address, Env, String, Symbol,
};

use crate::contract::{RWATokenContract, RWATokenContractClient};

// The real compliance dispatcher and identity verifier, so these tests run
// against the same artifacts that get deployed.
mod compliance_wasm {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/rwa_compliance_example.wasm"
    );
}
const REGISTRY_WASM: &[u8] =
    include_bytes!("../../../target/wasm32v1-none/release/rwa_identity_registry_example.wasm");
const TOPICS_WASM: &[u8] = include_bytes!(
    "../../../target/wasm32v1-none/release/rwa_claim_topics_and_issuers_example.wasm"
);
const VERIFIER_WASM: &[u8] =
    include_bytes!("../../../target/wasm32v1-none/release/rwa_identity_verifier_example.wasm");

/// A verifier that approves everyone, to exercise what the token does *after*
/// identity has passed. The rejection side is tested against the real one.
#[contract]
pub struct PermissiveVerifier;

#[contractimpl]
impl PermissiveVerifier {
    pub fn verify_identity(_e: &Env, _account: Address) {}

    pub fn recovery_target(_e: &Env, _old_account: Address) -> Option<Address> {
        None
    }
}

struct Fixture<'a> {
    e: Env,
    token: RWATokenContractClient<'a>,
    admin: Address,
    manager: Address,
}

fn setup(permissive: bool) -> Fixture<'static> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 1_700_000_000);

    let admin = Address::generate(&e);
    let manager = Address::generate(&e);

    let compliance = e.register(compliance_wasm::WASM, (admin.clone(), manager.clone()));

    let verifier = if permissive {
        e.register(PermissiveVerifier, ())
    } else {
        let topics = e.register(TOPICS_WASM, (admin.clone(), manager.clone()));
        let registry = e.register(REGISTRY_WASM, (admin.clone(), manager.clone()));
        e.register(
            VERIFIER_WASM,
            (admin.clone(), manager.clone(), registry, topics),
        )
    };

    let token = e.register(
        RWATokenContract,
        (
            String::from_str(&e, "Casa Escazu"),
            String::from_str(&e, "CASA"),
            admin.clone(),
            manager.clone(),
            compliance.clone(),
            verifier,
        ),
    );

    // The compliance dispatcher rejects hooks for tokens it was not bound to.
    compliance_wasm::Client::new(&e, &compliance).bind_token(&token, &manager);

    Fixture {
        token: RWATokenContractClient::new(&e, &token),
        e,
        admin,
        manager,
    }
}

#[test]
fn metadata_and_roles_come_from_the_constructor() {
    let f = setup(true);

    assert_eq!(f.token.name(), String::from_str(&f.e, "Casa Escazu"));
    assert_eq!(f.token.symbol(), String::from_str(&f.e, "CASA"));
    assert_eq!(f.token.decimals(), 7);
    assert_eq!(f.token.total_supply(), 0);
    assert!(f
        .token
        .has_role(&f.manager, &Symbol::new(&f.e, "manager"))
        .is_some());
}

/// The whole point of SEP-57: a wallet with no verified claims cannot be given
/// tokens, even by the manager.
#[test]
fn an_unverified_wallet_cannot_receive() {
    let f = setup(false);
    let stranger = Address::generate(&f.e);

    assert!(f.token.try_mint(&stranger, &1_000, &f.manager).is_err());
    assert_eq!(f.token.total_supply(), 0);
}

#[test]
fn minting_needs_the_manager_role() {
    let f = setup(true);
    let investor = Address::generate(&f.e);
    let nobody = Address::generate(&f.e);

    assert!(f.token.try_mint(&investor, &1_000, &nobody).is_err());

    f.token.mint(&investor, &1_000, &f.manager);
    assert_eq!(f.token.balance(&investor), 1_000);
    assert_eq!(f.token.total_supply(), 1_000);
}

#[test]
fn verified_holders_can_transfer_between_themselves() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);

    f.token.mint(&alice, &1_000, &f.manager);
    f.token.transfer(&alice, &bob, &400);

    assert_eq!(f.token.balance(&alice), 600);
    assert_eq!(f.token.balance(&bob), 400);
}

#[test]
fn a_frozen_address_cannot_send() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    f.token.mint(&alice, &1_000, &f.manager);

    f.token.set_address_frozen(&alice, &true, &f.manager);
    assert!(f.token.is_frozen(&alice));
    assert!(f.token.try_transfer(&alice, &bob, &100).is_err());

    f.token.set_address_frozen(&alice, &false, &f.manager);
    f.token.transfer(&alice, &bob, &100);
    assert_eq!(f.token.balance(&bob), 100);
}

#[test]
fn partially_frozen_tokens_stay_put() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    f.token.mint(&alice, &1_000, &f.manager);

    f.token.freeze_partial_tokens(&alice, &800, &f.manager);
    assert_eq!(f.token.get_frozen_tokens(&alice), 800);

    // The free 200 move; the 801st does not.
    f.token.transfer(&alice, &bob, &200);
    assert!(f.token.try_transfer(&alice, &bob, &1).is_err());
}

/// Neko can always move tokens out of a sanctioned or compromised wallet, and
/// a forced transfer works even while the token is paused.
#[test]
fn forced_transfer_overrides_freezing_and_pausing() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let treasury = Address::generate(&f.e);
    f.token.mint(&alice, &1_000, &f.manager);
    f.token.set_address_frozen(&alice, &true, &f.manager);

    f.token.pause(&f.admin);
    assert!(f.token.paused());

    f.token
        .forced_transfer(&alice, &treasury, &1_000, &f.manager);
    assert_eq!(f.token.balance(&treasury), 1_000);
    assert_eq!(f.token.balance(&alice), 0);
}

#[test]
fn pausing_stops_ordinary_transfers() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    f.token.mint(&alice, &1_000, &f.manager);

    f.token.pause(&f.admin);
    assert!(f.token.try_transfer(&alice, &bob, &100).is_err());

    f.token.unpause(&f.admin);
    f.token.transfer(&alice, &bob, &100);
    assert_eq!(f.token.balance(&bob), 100);
}

#[test]
fn burning_needs_the_manager_role() {
    let f = setup(true);
    let alice = Address::generate(&f.e);
    let nobody = Address::generate(&f.e);
    f.token.mint(&alice, &1_000, &f.manager);

    assert!(f.token.try_burn(&alice, &400, &nobody).is_err());

    f.token.burn(&alice, &400, &f.manager);
    assert_eq!(f.token.balance(&alice), 600);
    assert_eq!(f.token.total_supply(), 600);
}

/// SEP-57 lists `onchain_id` as token metadata, and OpenZeppelin's example
/// exposes only the getter, so a fresh token panics on it forever. Neko adds
/// the setter; this is the test for it.
#[test]
fn onchain_id_is_unset_until_a_manager_sets_it() {
    let f = setup(true);
    let issuer_identity = Address::generate(&f.e);
    let nobody = Address::generate(&f.e);

    // Nothing to read yet.
    assert!(f.token.try_onchain_id().is_err());

    assert!(f
        .token
        .try_set_onchain_id(&issuer_identity, &nobody)
        .is_err());

    f.token.set_onchain_id(&issuer_identity, &f.manager);
    assert_eq!(f.token.onchain_id(), issuer_identity);
}
