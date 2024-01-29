using ControllerV2Harness as controller;

methods {
    function borrowBalanceStored(address) external returns (uint256) envfree;

    function controller.calcAccountEquity(address) external returns (uint256,uint256,uint256,uint256) envfree;

    // Oracle
    function _.getUnderlyingPrice(address) external => CONSTANT;
    function _.getUnderlyingPriceAndStatus(address) external => CONSTANT;
    function _.getBorrowRate(uint256,uint256,uint256)(address) external => CONSTANT;

    // Reward Distributor
	function _.updateReward(address,address,bool) external => HAVOC_ECF;
	function _.updateDistributionState(address,bool) external => HAVOC_ECF;

    // Controller iToken
    function _.borrowBalanceStored(address) external => DISPATCHER(true);
    function _.balanceOf(address) external => DISPATCHER(true);
    function _.exchangeRateStored()(address) external => DISPATCHER(true);
}

/******************************************************************************************************
    STATUS: PASS

    Why any case can pass?
*******************************************************************************************************/
rule solventUserCanNotBecomeInsolvent(address user,  method f) 
    filtered { f ->  !f.isView }
{
    env e;
    calldataarg arg;

    uint256 beforeEquity;
    uint256 beforeShorfall;
    uint256 r3;
    uint256 r4;

    beforeEquity, beforeShorfall, r3, r4 = controller.calcAccountEquity(user);

    require borrowBalanceStored(user) > 0;
    require beforeShorfall == 0;

    f(e, arg);

    uint256 afterEquity;
    uint256 afterShorfall;

    afterEquity, afterShorfall, r3, r4 = controller.calcAccountEquity(user);

    assert borrowBalanceStored(user) == 0;

    assert afterEquity == 0, "Solvent user become insolvent";
}