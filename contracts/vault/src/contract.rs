//! Neko Vault.
//!
//! Holds the money side of one tokenization. Investors deposit USDC and
//! receive RWA tokens 1:1, the raise is released to the borrower, the borrower
//! repays in tranches, and each investor redeems their share of the total once
//! the vault settles.
//!
//! The vault never holds the RWA token. It only needs the `manager` role on it
//! to mint and burn, and the tokens live in the investors' own wallets. That
//! keeps the vault out of the identity registry: the RWA token verifies the
//! identity of whoever *receives* tokens, and that is always an investor.
//!
//! The vault does not compute interest. `expected_repayment` is set once at
//! creation as `target * (1 + rate)`, and a vault settles when the borrower has
//! paid at least that much. Each investor's share then falls out of their token
//! balance over the supply frozen at settlement.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, token::Client as TokenClient, Address, Env, String, Symbol,
    Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;

const MANAGER_ROLE: Symbol = symbol_short!("manager");

/// Basis-point denominator for the early-exit fee.
const BPS_DENOMINATOR: i128 = 10_000;

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const TTL_EXTEND_TO: u32 = DAY_IN_LEDGERS * 90;

/// The slice of the RWA token this vault calls.
///
/// `mint` and `burn` take an `operator` because the token gates them behind the
/// `manager` role; the vault passes its own address and the call is authorized
/// because the vault is the token's direct invoker.
#[contractclient(name = "RwaTokenClient")]
pub trait RwaTokenInterface {
    fn balance(e: Env, id: Address) -> i128;
    fn total_supply(e: Env) -> i128;
    fn mint(e: Env, to: Address, amount: i128, operator: Address);
    fn burn(e: Env, user_address: Address, amount: i128, operator: Address);
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    /// The call is not valid in the vault's current state.
    InvalidState = 1,
    /// Amount must be greater than zero.
    InvalidAmount = 2,
    /// The vault would raise more than its target.
    TargetExceeded = 3,
    /// The funding deadline has passed.
    FundingClosed = 4,
    /// The caller holds no tokens in this vault.
    NothingToRedeem = 5,
    /// The vault does not hold enough USDC to settle this early exit.
    InsufficientLiquidity = 6,
    /// The requested exit fee is above the vault's immutable cap.
    FeeAboveCap = 7,
    /// No tranche with that index.
    UnknownTranche = 8,
    /// That tranche was already paid.
    TranchePaid = 9,
    /// The constructor arguments do not describe a workable vault.
    InvalidConfig = 10,
    /// Tokens are still outstanding.
    SupplyOutstanding = 11,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VaultState {
    /// Taking deposits.
    Funding,
    /// The round closed at or above its minimum; the raise has not left yet.
    Funded,
    /// The raise is with the borrower and repayment is under way.
    Active,
    /// The borrower paid the full expected amount; investors can redeem.
    Settled,
    /// The round closed below its minimum; investors can refund at par.
    Failed,
}

/// One scheduled repayment from the borrower.
#[contracttype]
#[derive(Clone)]
pub struct Tranche {
    pub index: u32,
    pub expected_amount: i128,
    pub due_date: u64,
    /// Still `0` while the tranche is unpaid; `repay` rejects amounts of zero,
    /// so this doubles as the "already paid" flag.
    pub paid_amount: i128,
    /// Ledger timestamp of the payment.
    pub paid_at: u64,
    pub evidence_uri: String,
}

/// A tranche as given to the constructor, before anything is paid.
#[contracttype]
#[derive(Clone)]
pub struct TrancheInit {
    pub expected_amount: i128,
    pub due_date: u64,
}

/// Everything about the vault that is fixed when it is created.
#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub token: Address,
    pub usdc: Address,
    pub borrower: Address,
    pub target: i128,
    pub min_target: i128,
    /// Principal plus interest, in USDC units. The rate itself lives off-chain.
    pub expected_repayment: i128,
    pub funding_deadline: u64,
    /// The ceiling the exit fee can never pass. Deliberately has no setter: it
    /// is what an investor is shown before committing.
    pub max_exit_fee_bps: u32,
    pub fee_recipient: Address,
}

#[contracttype]
pub enum DataKey {
    Config,
    State,
    Raised,
    Repaid,
    EarlyExitPaid,
    ExitFeeBps,
    SupplyAtSettlement,
    TrancheCount,
    Tranche(u32),
}

// ------------------------------------------------------------------- Events
//
// Every state change publishes one, so the whole life of a vault can be read
// off the ledger in an explorer without trusting any off-chain record.

#[contractevent]
pub struct Invested {
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct FundingClosed {
    #[topic]
    pub state: VaultState,
    pub raised: i128,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub borrower: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TranchePaidEvent {
    #[topic]
    pub tranche: u32,
    pub amount: i128,
    pub total_repaid: i128,
}

#[contractevent]
pub struct Settled {
    pub total_repaid: i128,
    pub supply: i128,
}

#[contractevent]
pub struct EarlyExited {
    #[topic]
    pub investor: Address,
    pub principal: i128,
    pub payout: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Redeemed {
    #[topic]
    pub investor: Address,
    pub tokens: i128,
    pub payout: i128,
}

#[contractevent]
pub struct ExitFeeChanged {
    pub bps: u32,
}

#[contractevent]
pub struct DustSwept {
    pub amount: i128,
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        manager: Address,
        config: Config,
        exit_fee_bps: u32,
        tranches: Vec<TrancheInit>,
    ) {
        if config.target <= 0
            || config.min_target <= 0
            || config.min_target > config.target
            || config.expected_repayment < config.target
            || exit_fee_bps > config.max_exit_fee_bps
            || config.max_exit_fee_bps as i128 >= BPS_DENOMINATOR
        {
            panic_with_error!(e, VaultError::InvalidConfig);
        }

        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);

        let storage = e.storage().instance();
        storage.set(&DataKey::Config, &config);
        storage.set(&DataKey::State, &VaultState::Funding);
        storage.set(&DataKey::Raised, &0i128);
        storage.set(&DataKey::Repaid, &0i128);
        storage.set(&DataKey::EarlyExitPaid, &0i128);
        storage.set(&DataKey::ExitFeeBps, &exit_fee_bps);
        storage.set(&DataKey::SupplyAtSettlement, &0i128);
        storage.set(&DataKey::TrancheCount, &tranches.len());

        for (index, init) in tranches.iter().enumerate() {
            if init.expected_amount <= 0 {
                panic_with_error!(e, VaultError::InvalidConfig);
            }
            write_tranche(
                e,
                &Tranche {
                    index: index as u32,
                    expected_amount: init.expected_amount,
                    due_date: init.due_date,
                    paid_amount: 0,
                    paid_at: 0,
                    evidence_uri: String::from_str(e, ""),
                },
            );
        }
    }

    // ----------------------------------------------------------------- Funding

    /// Deposit `amount` of USDC and receive the same number of vault tokens.
    ///
    /// The mint runs the token's identity check on `investor`, so a wallet
    /// without verified KYC claims cannot invest.
    pub fn invest(e: &Env, investor: Address, amount: i128) {
        investor.require_auth();
        require_state(e, VaultState::Funding);

        if amount <= 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }

        let config = config(e);
        if e.ledger().timestamp() > config.funding_deadline {
            panic_with_error!(e, VaultError::FundingClosed);
        }

        let raised = read_i128(e, &DataKey::Raised) + amount;
        if raised > config.target {
            panic_with_error!(e, VaultError::TargetExceeded);
        }

        let vault = e.current_contract_address();
        TokenClient::new(e, &config.usdc).transfer(&investor, &vault, &amount);
        RwaTokenClient::new(e, &config.token).mint(&investor, &amount, &vault);

        e.storage().instance().set(&DataKey::Raised, &raised);
        Invested { investor, amount }.publish(e);
    }

    /// Close the round: `Funded` if it reached its minimum, `Failed` if not.
    #[only_role(operator, "manager")]
    pub fn close_funding(e: &Env, operator: Address) {
        require_state(e, VaultState::Funding);

        let raised = read_i128(e, &DataKey::Raised);
        let state = if raised >= config(e).min_target {
            VaultState::Funded
        } else {
            VaultState::Failed
        };

        set_state(e, state);
        FundingClosed { state, raised }.publish(e);
    }

    /// Send the raise to the borrower and start the repayment period.
    #[only_role(operator, "manager")]
    pub fn release(e: &Env, operator: Address) {
        require_state(e, VaultState::Funded);

        let config = config(e);
        let amount = read_i128(e, &DataKey::Raised);
        TokenClient::new(e, &config.usdc).transfer(
            &e.current_contract_address(),
            &config.borrower,
            &amount,
        );

        set_state(e, VaultState::Active);
        Released {
            borrower: config.borrower,
            amount,
        }
        .publish(e);
    }

    /// Take back a deposit at par after a round that failed to fill.
    pub fn refund(e: &Env, investor: Address) {
        investor.require_auth();
        require_state(e, VaultState::Failed);

        let config = config(e);
        let vault = e.current_contract_address();
        let token = RwaTokenClient::new(e, &config.token);

        let principal = token.balance(&investor);
        if principal <= 0 {
            panic_with_error!(e, VaultError::NothingToRedeem);
        }

        token.burn(&investor, &principal, &vault);
        TokenClient::new(e, &config.usdc).transfer(&vault, &investor, &principal);

        Refunded {
            investor,
            amount: principal,
        }
        .publish(e);
    }

    // --------------------------------------------------------------- Repayment

    /// Pay one tranche. The vault settles once the total reaches
    /// `expected_repayment`, freezing the supply the payout is divided over.
    pub fn repay(e: &Env, tranche_index: u32, amount: i128, evidence_uri: String) {
        let config = config(e);
        config.borrower.require_auth();
        require_state(e, VaultState::Active);

        if amount <= 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }

        let mut tranche = tranche(e, tranche_index);
        if tranche.paid_amount > 0 {
            panic_with_error!(e, VaultError::TranchePaid);
        }

        let vault = e.current_contract_address();
        TokenClient::new(e, &config.usdc).transfer(&config.borrower, &vault, &amount);

        tranche.paid_amount = amount;
        tranche.paid_at = e.ledger().timestamp();
        tranche.evidence_uri = evidence_uri;
        write_tranche(e, &tranche);

        let repaid = read_i128(e, &DataKey::Repaid) + amount;
        e.storage().instance().set(&DataKey::Repaid, &repaid);
        TranchePaidEvent {
            tranche: tranche_index,
            amount,
            total_repaid: repaid,
        }
        .publish(e);

        if repaid >= config.expected_repayment {
            let supply = RwaTokenClient::new(e, &config.token).total_supply();
            e.storage()
                .instance()
                .set(&DataKey::SupplyAtSettlement, &supply);
            set_state(e, VaultState::Settled);
            Settled {
                total_repaid: repaid,
                supply,
            }
            .publish(e);
        }
    }

    // ----------------------------------------------------------------- Exiting

    /// Leave before maturity: capital back minus the exit fee, no interest.
    ///
    /// Paid out of whatever the borrower has repaid so far, so a large holder
    /// may have to wait for a few tranches before there is enough to buy them
    /// out. Reverting rather than part-paying is also what keeps
    /// `early_exit_paid` from ever passing `repaid`, which is what makes the
    /// redemption pool safe from going short.
    pub fn early_exit(e: &Env, investor: Address) {
        investor.require_auth();
        require_state(e, VaultState::Active);

        let config = config(e);
        let vault = e.current_contract_address();
        let token = RwaTokenClient::new(e, &config.token);

        let principal = token.balance(&investor);
        if principal <= 0 {
            panic_with_error!(e, VaultError::NothingToRedeem);
        }

        let usdc = TokenClient::new(e, &config.usdc);
        if usdc.balance(&vault) < principal {
            panic_with_error!(e, VaultError::InsufficientLiquidity);
        }

        let fee = principal * i128::from(exit_fee_bps(e)) / BPS_DENOMINATOR;
        let payout = principal - fee;

        token.burn(&investor, &principal, &vault);
        usdc.transfer(&vault, &investor, &payout);
        if fee > 0 {
            usdc.transfer(&vault, &config.fee_recipient, &fee);
        }

        let paid = read_i128(e, &DataKey::EarlyExitPaid) + principal;
        e.storage().instance().set(&DataKey::EarlyExitPaid, &paid);
        EarlyExited {
            investor,
            principal,
            payout,
            fee,
        }
        .publish(e);
    }

    /// Collect principal plus the share of interest earned by the tokens held.
    pub fn redeem(e: &Env, investor: Address) {
        investor.require_auth();
        require_state(e, VaultState::Settled);

        let config = config(e);
        let vault = e.current_contract_address();
        let token = RwaTokenClient::new(e, &config.token);

        let balance = token.balance(&investor);
        if balance <= 0 {
            panic_with_error!(e, VaultError::NothingToRedeem);
        }

        let payout = payout_for(e, balance);
        token.burn(&investor, &balance, &vault);
        TokenClient::new(e, &config.usdc).transfer(&vault, &investor, &payout);

        Redeemed {
            investor,
            tokens: balance,
            payout,
        }
        .publish(e);
    }

    // ------------------------------------------------------------------- Admin

    /// Change the exit fee, never above the cap fixed when the vault was created.
    #[only_role(operator, "manager")]
    pub fn set_exit_fee(e: &Env, bps: u32, operator: Address) {
        if bps > config(e).max_exit_fee_bps {
            panic_with_error!(e, VaultError::FeeAboveCap);
        }
        e.storage().instance().set(&DataKey::ExitFeeBps, &bps);
        ExitFeeChanged { bps }.publish(e);
    }

    /// Send the rounding dust left after every investor has redeemed.
    #[only_role(operator, "manager")]
    pub fn sweep_dust(e: &Env, operator: Address) {
        require_state(e, VaultState::Settled);

        let config = config(e);
        if RwaTokenClient::new(e, &config.token).total_supply() != 0 {
            panic_with_error!(e, VaultError::SupplyOutstanding);
        }

        let vault = e.current_contract_address();
        let usdc = TokenClient::new(e, &config.usdc);
        let left = usdc.balance(&vault);
        if left > 0 {
            usdc.transfer(&vault, &config.fee_recipient, &left);
            DustSwept { amount: left }.publish(e);
        }
    }

    // ------------------------------------------------------------------- Views

    pub fn get_state(e: &Env) -> VaultState {
        state(e)
    }

    pub fn get_config(e: &Env) -> Config {
        config(e)
    }

    pub fn raised(e: &Env) -> i128 {
        read_i128(e, &DataKey::Raised)
    }

    pub fn repaid(e: &Env) -> i128 {
        read_i128(e, &DataKey::Repaid)
    }

    pub fn early_exit_paid(e: &Env) -> i128 {
        read_i128(e, &DataKey::EarlyExitPaid)
    }

    pub fn exit_fee(e: &Env) -> u32 {
        exit_fee_bps(e)
    }

    pub fn get_tranche(e: &Env, index: u32) -> Tranche {
        tranche(e, index)
    }

    pub fn list_tranches(e: &Env) -> Vec<Tranche> {
        let count: u32 = e
            .storage()
            .instance()
            .get(&DataKey::TrancheCount)
            .unwrap_or(0);
        let mut out = Vec::new(e);
        for index in 0..count {
            out.push_back(tranche(e, index));
        }
        out
    }

    /// What `investor` would collect from `redeem`, or `0` before settlement.
    pub fn claimable(e: &Env, investor: Address) -> i128 {
        if state(e) != VaultState::Settled {
            return 0;
        }
        let balance = RwaTokenClient::new(e, &config(e).token).balance(&investor);
        if balance <= 0 {
            return 0;
        }
        payout_for(e, balance)
    }

    /// What `investor` would collect from `early_exit` right now.
    pub fn exit_value(e: &Env, investor: Address) -> i128 {
        let principal = RwaTokenClient::new(e, &config(e).token).balance(&investor);
        if principal <= 0 {
            return 0;
        }
        principal - principal * i128::from(exit_fee_bps(e)) / BPS_DENOMINATOR
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for VaultContract {}

// ------------------------------------------------------------------- Internals

fn config(e: &Env) -> Config {
    e.storage().instance().get(&DataKey::Config).unwrap()
}

fn state(e: &Env) -> VaultState {
    e.storage().instance().get(&DataKey::State).unwrap()
}

fn set_state(e: &Env, state: VaultState) {
    e.storage().instance().set(&DataKey::State, &state);
}

fn require_state(e: &Env, expected: VaultState) {
    if state(e) != expected {
        panic_with_error!(e, VaultError::InvalidState);
    }
}

fn read_i128(e: &Env, key: &DataKey) -> i128 {
    e.storage().instance().get(key).unwrap_or(0)
}

fn exit_fee_bps(e: &Env) -> u32 {
    e.storage()
        .instance()
        .get(&DataKey::ExitFeeBps)
        .unwrap_or(0)
}

/// The pool a settled vault divides between holders: everything the borrower
/// repaid, less what early exits already took out of it.
fn payout_for(e: &Env, balance: i128) -> i128 {
    let supply = read_i128(e, &DataKey::SupplyAtSettlement);
    if supply <= 0 {
        return 0;
    }
    let distributable = read_i128(e, &DataKey::Repaid) - read_i128(e, &DataKey::EarlyExitPaid);
    distributable * balance / supply
}

fn tranche(e: &Env, index: u32) -> Tranche {
    let key = DataKey::Tranche(index);
    match e.storage().persistent().get::<_, Tranche>(&key) {
        Some(tranche) => {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            tranche
        }
        None => panic_with_error!(e, VaultError::UnknownTranche),
    }
}

fn write_tranche(e: &Env, tranche: &Tranche) {
    let key = DataKey::Tranche(tranche.index);
    e.storage().persistent().set(&key, tranche);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
