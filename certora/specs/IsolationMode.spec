methods {
    function enterMarkets(address[] calldata _iTokens) external returns (bool[]);
    function marketsV2(address iToken) external returns (ControllerStorageV2.MarketV2 memory) optional envfree;
    function getIsolationModeState(address account) external returns (bool, address) optional envfree;

    function hasiToken(address _iToken) external returns (bool) envfree;
    function hasEnteredMarket(address _account, address _iToken) external returns (bool) envfree;

    // Harnesses
    function Harness_collateralsLength(address) external returns(uint256) envfree;
    function Harness_isiTokenIsolated(address) external returns(bool) envfree;
    function Harness_isInIsolationMode(address) external returns(bool) envfree;
    function Harness_getIsolatedCollateral(address account) external returns (address) envfree;

}

definition MAX_UINT256() returns uint256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
definition isNormalUserOp(env e, address sender) returns bool = e.msg.value == 0 && e.msg.sender == sender;
definition collateralSanity(address account) returns bool = Harness_collateralsLength(account) < MAX_UINT256();

/******************************************************************************************************
    STATUS: PASS
*******************************************************************************************************/
rule noCollateralCanAlwaysEnterMarkets(address iToken, address sender) {
    env e;

    require isNormalUserOp(e, sender);
    
    require Harness_collateralsLength(e.msg.sender) == 0;
    require hasiToken(iToken) == true;

    enterMarkets@withrevert(e, [iToken]);

    bool succeeded = !lastReverted;
    bool entered = hasEnteredMarket(e.msg.sender, iToken);

    assert succeeded && entered,
        "User should enter the any market directly when do not have any collaterals";
}

/******************************************************************************************************
    STATUS: PASS
*******************************************************************************************************/
rule enteredIsolationMarketMustInIsolationMode(address iToken, address sender) {
    env e;

    require isNormalUserOp(e, sender);

    // Will enter a new isolated market
    ControllerStorageV2.MarketV2 market = marketsV2(iToken);
    require hasiToken(iToken) == true && market.debtCeiling != 0;
    require !hasEnteredMarket(sender, iToken);

    enterMarkets(e, [iToken]);

    bool isInIsolationMode; 
    address isolatedCollateral;
    isInIsolationMode, isolatedCollateral = getIsolationModeState(sender);

    assert isInIsolationMode && isolatedCollateral == iToken,
        "User entered the isolated market should in isolation state";
}

/******************************************************************************************************
    STATUS: FAIL

    https://prover.certora.com/output/49171/8a56fc2ea9564f10903e601de0ac5bac?anonymousKey=54bb56c110e80dfe6c8dbbf6e857a8d850e07d89
*******************************************************************************************************/
rule nonIsolatedMarketCanNotBeChangeToIsolated(address nonIsolated) {
    env e;
    method f;
    calldataarg arg;

    require e.msg.value == 0;
    require hasiToken(nonIsolated) && !Harness_isiTokenIsolated(nonIsolated);

    f(e, arg);

    assert !Harness_isiTokenIsolated(nonIsolated), "Non-isolated market can not be changed to isolated";
}

/******************************************************************************************************
    STATUS: FAIL

    https://prover.certora.com/output/49171/8a56fc2ea9564f10903e601de0ac5bac?anonymousKey=54bb56c110e80dfe6c8dbbf6e857a8d850e07d89
*******************************************************************************************************/
invariant integrityOfHasEnteredIsolatedMarket(address isolated, address sender)
    hasEnteredMarket(sender, isolated) && Harness_isiTokenIsolated(isolated) 
        => Harness_isInIsolationMode(sender);

/******************************************************************************************************
    STATUS: FAIL

    https://prover.certora.com/output/49171/0f6fb1c890cc49ec9b7bf2e3e2ec16eb?anonymousKey=d7ef8d525de3d68f1f8d53918bc74b06c6dc1fd7
*******************************************************************************************************/
invariant integrityOfIsInIsolationMode(address isolated, address other, address sender)
    Harness_isInIsolationMode(sender) 
        && Harness_getIsolatedCollateral(sender) == isolated 
        && isolated != other 
        => !hasEnteredMarket(sender, other) && Harness_collateralsLength(sender) == 1
    {
        preserved {
            require collateralSanity(sender);
        }
    }

