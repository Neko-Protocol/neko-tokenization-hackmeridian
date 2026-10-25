extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger as _},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, Env, String, Vec,
};

use crate::contract::{
    Config, TrancheInit, VaultContract, VaultContractClient, VaultError, VaultState,
};

// A stand-in for the RWA token: just the four functions the vault calls. The
// real token adds identity verification and role checks on top, which are
// covered by the RWA suite's own tests.
#[contracttype]
enum MockKey {
    Balance(Address),
    Supply,
}

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn balance(e: &Env, id: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&MockKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn total_supply(e: &Env) -> i128 {
        e.storage().instance().get(&MockKey::Supply).unwrap_or(0)
    }

    pub fn mint(e: &Env, to: Address, amount: i128, _operator: Address) {
        let balance = Self::balance(e, to.clone()) + amount;
        e.storage()
            .persistent()
            .set(&MockKey::Balance(to), &balance);
        let supply = Self::total_supply(e) + amount;
        e.storage().instance().set(&MockKey::Supply, &supply);
    }

    pub fn burn(e: &Env, user_address: Address, amount: i128, _operator: Address) {
        let balance = Self::balance(e, user_address.clone()) - amount;
        e.storage()
            .persistent()
            .set(&MockKey::Balance(user_address), &balance);
        let supply = Self::total_supply(e) - amount;
        e.storage().instance().set(&MockKey::Supply, &supply);
    }
}

const TARGET: i128 = 100_000;
const MIN_TARGET: i128 = 50_000;
/// 100_000 at 13%.
const EXPECTED_REPAYMENT: i128 = 113_000;
const EXIT_FEE_BPS: u32 = 500;
const MAX_EXIT_FEE_BPS: u32 = 1_000;

struct Fixture<'a> {
    e: Env,
    vault: VaultContractClient<'a>,
    usdc: Address,
    token: Address,
    manager: Address,
    borrower: Address,
    fee_recipient: Address,
}

impl Fixture<'_> {
    fn usdc(&self) -> TokenClient<'_> {
        TokenClient::new(&self.e, &self.usdc)
    }

    fn token(&self) -> MockTokenClient<'_> {
        MockTokenClient::new(&self.e, &self.token)
    }

    fn investor(&self, funding: i128) -> Address {
        let investor = Address::generate(&self.e);
        StellarAssetClient::new(&self.e, &self.usdc).mint(&investor, &funding);
        investor
    }
}

fn setup() -> Fixture<'static> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 1_700_000_000);

    let admin = Address::generate(&e);
    let manager = Address::generate(&e);
    let borrower = Address::generate(&e);
    let fee_recipient = Address::generate(&e);

    let usdc = e
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token = e.register(MockToken, ());
    let tranches = three_tranches(&e);

    let config = Config {
        token: token.clone(),
        usdc: usdc.clone(),
        borrower: borrower.clone(),
        target: TARGET,
        min_target: MIN_TARGET,
        expected_repayment: EXPECTED_REPAYMENT,
        funding_deadline: u64::MAX,
        max_exit_fee_bps: MAX_EXIT_FEE_BPS,
        fee_recipient: fee_recipient.clone(),
    };

    let vault = e.register(
        VaultContract,
        (
            admin.clone(),
            manager.clone(),
            config,
            EXIT_FEE_BPS,
            tranches,
        ),
    );

    Fixture {
        vault: VaultContractClient::new(&e, &vault),
        e,
        usdc,
        token,
        manager,
        borrower,
        fee_recipient,
    }
}

/// The demo schedule: 40k + 40k + 33k repays 100k at 13%.
fn three_tranches(e: &Env) -> Vec<TrancheInit> {
    vec![
        e,
        TrancheInit {
            expected_amount: 40_000,
            due_date: 1,
        },
        TrancheInit {
            expected_amount: 40_000,
            due_date: 2,
        },
        TrancheInit {
            expected_amount: 33_000,
            due_date: 3,
        },
    ]
}

fn evidence(e: &Env) -> String {
    String::from_str(e, "ipfs://receipt")
}

/// Fund to target with two investors, close the round and send the raise out.
fn fund_and_release(f: &Fixture, a_amount: i128, b_amount: i128) -> (Address, Address) {
    let a = f.investor(a_amount);
    let b = f.investor(b_amount);

    f.vault.invest(&a, &a_amount);
    f.vault.invest(&b, &b_amount);
    f.vault.close_funding(&f.manager);
    f.vault.release(&f.manager);
    assert_eq!(f.usdc().balance(&f.borrower), TARGET);

    // The interest is earned off-chain, so the borrower needs it on hand to
    // repay more than the raise.
    StellarAssetClient::new(&f.e, &f.usdc).mint(&f.borrower, &(EXPECTED_REPAYMENT - TARGET));

    (a, b)
}

#[test]
fn full_path_pays_principal_plus_interest() {
    let f = setup();
    let (a, b) = fund_and_release(&f, 60_000, 40_000);

    assert_eq!(f.vault.get_state(), VaultState::Active);
    assert_eq!(f.vault.raised(), TARGET);
    // The raise left the vault entirely.
    assert_eq!(f.usdc().balance(&f.vault.address), 0);

    f.vault.repay(&0, &40_000, &evidence(&f.e));
    f.vault.repay(&1, &40_000, &evidence(&f.e));
    assert_eq!(f.vault.get_state(), VaultState::Active);

    f.vault.repay(&2, &33_000, &evidence(&f.e));
    assert_eq!(f.vault.get_state(), VaultState::Settled);

    // 113_000 split by stake: 60% and 40%.
    assert_eq!(f.vault.claimable(&a), 67_800);
    assert_eq!(f.vault.claimable(&b), 45_200);

    f.vault.redeem(&a);
    f.vault.redeem(&b);

    assert_eq!(f.usdc().balance(&a), 67_800);
    assert_eq!(f.usdc().balance(&b), 45_200);
    // Every token redeemed, every dollar distributed.
    assert_eq!(f.token().total_supply(), 0);
    assert_eq!(f.usdc().balance(&f.vault.address), 0);
}

#[test]
fn tranches_record_payment_and_evidence() {
    let f = setup();
    fund_and_release(&f, 60_000, 40_000);

    assert_eq!(f.vault.get_tranche(&0).paid_at, 0);

    f.vault.repay(&0, &40_000, &evidence(&f.e));

    let tranche = f.vault.get_tranche(&0);
    assert_eq!(tranche.paid_amount, 40_000);
    assert_eq!(tranche.evidence_uri, evidence(&f.e));
    assert_ne!(tranche.paid_at, 0);
    assert_eq!(f.vault.list_tranches().len(), 3);
}

#[test]
fn early_exit_forfeits_interest_and_lifts_the_holders_who_stay() {
    let f = setup();
    let (a, b) = fund_and_release(&f, 60_000, 40_000);

    // The first tranche gives the vault the liquidity to buy B out.
    f.vault.repay(&0, &40_000, &evidence(&f.e));

    assert_eq!(f.vault.exit_value(&b), 38_000);
    f.vault.early_exit(&b);

    assert_eq!(f.usdc().balance(&b), 38_000);
    assert_eq!(f.usdc().balance(&f.fee_recipient), 2_000);
    assert_eq!(f.token().balance(&b), 0);
    assert_eq!(f.token().total_supply(), 60_000);

    f.vault.repay(&1, &40_000, &evidence(&f.e));
    f.vault.repay(&2, &33_000, &evidence(&f.e));
    assert_eq!(f.vault.get_state(), VaultState::Settled);

    // 113_000 repaid less the 40_000 B took out, all of it now A's.
    f.vault.redeem(&a);
    assert_eq!(f.usdc().balance(&a), 73_000);

    // A did better than the 67_800 they would have had if B had stayed.
    assert!(f.usdc().balance(&a) > 67_800);
    assert_eq!(f.usdc().balance(&f.vault.address), 0);
}

#[test]
fn early_exit_reverts_while_the_vault_is_dry() {
    let f = setup();
    let (_, b) = fund_and_release(&f, 60_000, 40_000);

    // Nothing repaid yet, so there is nothing to pay an exit with.
    assert_eq!(
        f.vault.try_early_exit(&b).unwrap_err().unwrap(),
        VaultError::InsufficientLiquidity.into()
    );
}

#[test]
fn failed_round_refunds_at_par() {
    let f = setup();

    let investor = f.investor(10_000);
    f.vault.invest(&investor, &10_000);
    f.vault.close_funding(&f.manager);

    assert_eq!(f.vault.get_state(), VaultState::Failed);

    f.vault.refund(&investor);
    assert_eq!(f.usdc().balance(&investor), 10_000);
    assert_eq!(f.token().balance(&investor), 0);
}

#[test]
fn invest_cannot_overshoot_the_target() {
    let f = setup();

    let investor = f.investor(TARGET + 1);
    assert_eq!(
        f.vault
            .try_invest(&investor, &(TARGET + 1))
            .unwrap_err()
            .unwrap(),
        VaultError::TargetExceeded.into()
    );
}

#[test]
fn exit_fee_moves_only_under_its_cap() {
    let f = setup();

    f.vault.set_exit_fee(&MAX_EXIT_FEE_BPS, &f.manager);
    assert_eq!(f.vault.exit_fee(), MAX_EXIT_FEE_BPS);

    assert_eq!(
        f.vault
            .try_set_exit_fee(&(MAX_EXIT_FEE_BPS + 1), &f.manager)
            .unwrap_err()
            .unwrap(),
        VaultError::FeeAboveCap.into()
    );
    assert_eq!(f.vault.exit_fee(), MAX_EXIT_FEE_BPS);
}

#[test]
fn a_tranche_is_paid_once() {
    let f = setup();
    fund_and_release(&f, 60_000, 40_000);

    f.vault.repay(&0, &40_000, &evidence(&f.e));
    assert_eq!(
        f.vault
            .try_repay(&0, &40_000, &evidence(&f.e))
            .unwrap_err()
            .unwrap(),
        VaultError::TranchePaid.into()
    );
}

#[test]
fn redeem_is_closed_until_the_vault_settles() {
    let f = setup();
    let (a, _) = fund_and_release(&f, 60_000, 40_000);

    assert_eq!(f.vault.claimable(&a), 0);
    assert_eq!(
        f.vault.try_redeem(&a).unwrap_err().unwrap(),
        VaultError::InvalidState.into()
    );
}

/// Integer division leaves a few units behind when a f does not divide
/// evenly. They stay in the vault until every token has been redeemed, and
/// then the platform can collect them.
#[test]
fn rounding_dust_is_swept_once_everyone_has_redeemed() {
    let f = setup();
    // 70_000 / 30_000 of a 113_000 payout divides unevenly.
    let (a, b) = fund_and_release(&f, 70_000, 30_000);

    f.vault.repay(&0, &40_000, &evidence(&f.e));
    f.vault.repay(&1, &40_000, &evidence(&f.e));
    f.vault.repay(&2, &33_000, &evidence(&f.e));

    f.vault.redeem(&a);
    f.vault.redeem(&b);

    // Whatever the split, the payouts and the remainder account for every
    // unit the borrower repaid: the vault can never pay out more than it holds.
    let left = f.usdc().balance(&f.vault.address);
    assert_eq!(
        f.usdc().balance(&a) + f.usdc().balance(&b) + left,
        EXPECTED_REPAYMENT
    );

    f.vault.sweep_dust(&f.manager);
    assert_eq!(f.usdc().balance(&f.vault.address), 0);
    assert_eq!(f.usdc().balance(&f.fee_recipient), left);
}

#[test]
fn dust_cannot_be_swept_while_tokens_are_outstanding() {
    let f = setup();
    let (a, _) = fund_and_release(&f, 60_000, 40_000);

    f.vault.repay(&0, &40_000, &evidence(&f.e));
    f.vault.repay(&1, &40_000, &evidence(&f.e));
    f.vault.repay(&2, &33_000, &evidence(&f.e));
    f.vault.redeem(&a);

    // B has not redeemed, so their money is not the platform's to take.
    assert_eq!(
        f.vault.try_sweep_dust(&f.manager).unwrap_err().unwrap(),
        VaultError::SupplyOutstanding.into()
    );
}
