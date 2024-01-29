methods {
    function enterMarkets(address[] calldata _iTokens) external returns (bool[]);
    function markets(address iToken) external returns (uint256, uint256, uint256, uint256, bool, bool, bool) optional envfree;

    function hasiToken(address _iToken) external returns (bool) envfree;
    function hasEnteredMarket(address _account, address _iToken) external returns (bool) envfree;
    function hasBorrowed(address _account, address _iToken) external returns (bool) envfree;

    // summarized
    // Reward Distributor
	function _.updateReward(address,address,bool) external => HAVOC_ECF;
	function _.updateDistributionState(address,bool) external => HAVOC_ECF;
	function _._addRecipient(address,bool) external => HAVOC_ECF;

    // iToken
    function _.controller() external => PER_CALLEE_CONSTANT;

    // ITimeLockStrategy
    function _.calculateTimeLockParams(address,uint256,address) external => HAVOC_ECF;
    function _.createAgreement(address,uint256,address,uint256) external => HAVOC_ECF;

    // Harnesses
    function Harness_iTokensLength() external returns(uint256) envfree;
    function Harness_collateralsLength(address) external returns(uint256) envfree;
    function Harness_borrowedLength(address) external returns(uint256) envfree;

    function Harness_indexOfiTokens(address) external returns(uint256) envfree;
    function Harness_indexOfCollaterals(address, address) external returns(uint256) envfree;
    function Harness_indexOfBorrowed(address, address) external returns(uint256) envfree;

    function Harness_atiTokens(uint256) external returns(address) envfree;
    function Harness_atCollaterals(uint256, address) external returns(address) envfree;
    function Harness_atBorrowed(uint256, address) external returns(address) envfree;

    function Harness_isiTokenIsolated(address iToken) external returns (bool) envfree;
    function Harness_isInIsolationMode(address account) external returns (bool) envfree;

}

// // Ghost for collaterals
// ghost mapping(address => uint) _collateralLength;

// hook Sstore map[KEY uint k] uint v STORAGE {
//     _map[k] = v;
// }

// hook Sload uint v map[KEY uint k] STORAGE {
//     require _map[k] == v;
// }

// hook Sload uint n keys[INDEX uint index] STORAGE {
//     require array[index] == n;
// }

// hook Sstore keys[INDEX uint index] uint n STORAGE {
//     array[index] = n;
// }


definition MAX_UINT256() returns uint256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
definition isNormalUserOp(env e, address sender) returns bool = e.msg.value == 0 && e.msg.sender == sender;


/******************************************************************************************************
    Safe Assumptions:
    - All user collateral & borrow should be a subset of listed iToken
    - 
*******************************************************************************************************/
function safeAssumption(address account) {
}

/******************************************************************************************************
    STATUS: PASS
    Why iToken does not need require `Harness_iTokensLength() < MAX_UINT256()`

    There is no function to remove market
*******************************************************************************************************/
// invariant consistencyiToken(address market)
//     hasiToken(market) => (
//         Harness_indexOfiTokens(market) > 0 &&
//         Harness_indexOfiTokens(market) <= Harness_iTokensLength() &&
//         Harness_atiTokens(require_uint256(Harness_indexOfiTokens(market) - 1)) == market
//     );

definition collateralSanity(address account) returns bool = Harness_collateralsLength(account) < MAX_UINT256();

/******************************************************************************************************
    STATUS: PASS
*******************************************************************************************************/
invariant consistencyCollateral(address market, address account)
    hasEnteredMarket(account, market)=> (
        Harness_indexOfCollaterals(market, account) > 0 &&
        Harness_indexOfCollaterals(market, account) <= Harness_collateralsLength(account) &&
        Harness_atCollaterals(require_uint256(Harness_indexOfCollaterals(market, account) - 1), account) == market
    )
    {
        preserved {
            require collateralSanity(account);
        }
    }

/******************************************************************************************************
    STATUS: PASS
    Why borrow does not need require `Harness_borrowedLength(account) < MAX_UINT256()`
*******************************************************************************************************/
invariant consistencyBorrow(address market, address account)
    hasBorrowed(account, market) => (
        Harness_indexOfBorrowed(market, account) > 0 &&
        Harness_indexOfBorrowed(market, account) <= Harness_borrowedLength(account) &&
        Harness_atBorrowed(require_uint256(Harness_indexOfBorrowed(market, account) - 1), account) == market
    );

/******************************************************************************************************
    STATUS: PASS

    The behaviour is not consistant:
        if iToken is not listed, it will return false;
        if user is already in or entering isolation mode, it could revert
        if user has already enter this market, it will return true, while the collateral length does not change
*******************************************************************************************************/
rule IntegrityEnterMarkets(address iToken, address sender) {
    env e;

    require isNormalUserOp(e, sender);
    require hasiToken(iToken); // user collateral and listed iToken can have different sets
    require collateralSanity(sender);

    bool beforeHasEntered = hasEnteredMarket(sender, iToken);
    uint256 beforeCollateralLength = Harness_collateralsLength(sender);

    bool[] succeeded;
    succeeded = enterMarkets(e, [iToken]);

    bool afterHasEntered = hasEnteredMarket(sender, iToken);
    uint256 afterCollateralLength = Harness_collateralsLength(sender);

    assert afterHasEntered == succeeded[0], "return value does not match hasEnteredMarket state";
    assert succeeded[0] && !beforeHasEntered <=> afterCollateralLength == require_uint256(beforeCollateralLength + 1), 
        "entered new market but collateral length does not increase by 1";
}

/******************************************************************************************************
    STATUS: FAIL

    REASON: HAVOC_ECF summary of `calculateTimeLockParams` does not work in fallback()

    https://prover.certora.com/output/49171/b5abd055ee414919b149f91c32f153b2?anonymousKey=9ec5f902c38551ceed9846bf431397be23867017
*******************************************************************************************************/
invariant integrityOfNoCollateral1(address sender)
    Harness_collateralsLength(sender) == 0 => Harness_borrowedLength(sender) == 0
    {
        preserved {
            require collateralSanity(sender);
        }
    }

/******************************************************************************************************
    STATUS: FAIL

    REASON: REASON: HAVOC_ECF summary of `calculateTimeLockParams` does not work in fallback()
*******************************************************************************************************/
// invariant integrityOfNoCollateral2(address sender, address market)
//     Harness_collateralsLength(sender) == 0 => !hasEnteredMarket(sender, market)
//     {
//         preserved {
//             require collateralSanity(sender);
//         }
//     }

/******************************************************************************************************
    STATUS: FAIL

    REASON: REASON: HAVOC_ECF summary of `calculateTimeLockParams` does not work in fallback()
*******************************************************************************************************/
invariant integrityOfHasCollateral(address sender, address market)
    hasEnteredMarket(sender, market) => Harness_collateralsLength(sender) > 0
    {
        preserved {
            require collateralSanity(sender);
        }
    }

/******************************************************************************************************
    STATUS: PASS

    A test to demonstrate that the EnumerableSet length can overflow
*******************************************************************************************************/
rule testEnumerableSetMaxiumLengthOverflow(address sender, address market) {
    env e;

    require isNormalUserOp(e, sender);
    require !hasEnteredMarket(sender, market) && hasiToken(market);
    require Harness_collateralsLength(sender) == MAX_UINT256();

    enterMarkets(e, [market]);

    assert Harness_collateralsLength(sender) == 0;
}

