const { utils, constants } = require("ethers");
const {
  loadFixture,
  fixtureV2,
  deployiTokenAndSetConfigs,
} = require("../../helpers/fixtures.js");
const { expect } = require("chai");

describe.skip("ControllerV2: Extra Explicit", function () {
  let controllerV2, iUSDx, iARB, user, userAddr;

  before(async function () {
    ({ controllerV2, iUSDx, iARB, accounts } = await loadFixture(fixtureV2));

    user = accounts[0];
    userAddr = await user.getAddress();
  });

  describe("Should not be able to fallback to Extra Logic", function () {
    const collateralFactor = utils.parseEther("0.9");
    const borrowFactor = utils.parseEther("1");
    const supplyCapacity = constants.MaxUint256;
    const borrowCapacity = constants.MaxUint256;
    const distributionFactor = utils.parseEther("1");
    const debtCeiling = 0;

    // These functions in ControllerV2ExtraLogic should be shadowed by ControllerV2
    // As they do not check the V1 logic, should only be delegatecall
    // rather than be direcly fallbacked
    const delegateOnlyCalls = [
      {
        func: "_upgrade",
        getCaller: () => user,
        getArgs: async () => [userAddr, userAddr],
        expectRevertReason: "onlyOwner: caller is not the owner",
      },
      {
        func: "_addMarketV2",
        getCaller: () => user,
        getArgs: async () => [
          {
            _iToken: iARB.address,
            _collateralFactor: collateralFactor,
            _borrowFactor: borrowFactor,
            _supplyCapacity: supplyCapacity,
            _borrowCapacity: borrowCapacity,
            _distributionFactor: distributionFactor,
            _eModeID: 0,
            _eModeLtv: collateralFactor,
            _eModeLiqThreshold: collateralFactor,
            _liquidationThreshold: collateralFactor,
            _debtCeiling: debtCeiling,
            _borrowableInIsolation: true,
          },
        ],
        expectRevertReason: "onlyOwner: caller is not the owner",
      },
      {
        func: "_setCollateralFactor",
        getCaller: () => user,
        getArgs: async () => [iARB.address, collateralFactor],
        expectRevertReason: "onlyOwner: caller is not the owner",
      },
      {
        func: "beforeBorrow",
        getCaller: () => user,
        getArgs: async () => [controllerV2.address, userAddr, 0],
        expectRevertReason: "Token has not been listed",
      },
      {
        func: "afterRepayBorrow",
        getCaller: () => user,
        getArgs: async () => [controllerV2.address, userAddr, userAddr, 0],
        expectRevertReason: "Token has not been listed",
      },
    ];

    delegateOnlyCalls.forEach((call) => {
      it(`${call.func}`, async function () {
        await expect(
          controllerV2
            .connect(call.getCaller())
            [call.func](...(await call.getArgs()))
        ).to.be.revertedWith(call.expectRevertReason);
      });
    });
  });
});
