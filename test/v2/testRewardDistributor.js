const chai = require("chai");
const { expect } = chai;
const { BigNumber, utils } = require("ethers");

const { solidity } = require("ethereum-waffle");

chai.use(solidity);

const {
  deployTreasuryAndConfig,
  fixtureDefault,
  fixtureV2,
  getCurrentTime,
  getEthBalance,
  increaseBlock,
  increaseTime,
  loadFixture,
  upgradeToV2,
} = require("../helpers/fixtures.js");
const { MAX, executeBatch } = require("../helpers/utils.js");

let controller, USDx, iUSDx, USDT, iUSDT, iETH, rewardDistributor;
let owner, accounts, user1, deployer;

let DF;
let depositor1, depositor2;

describe("Distribute rewards from V1 to V2", function () {
  async function depositAndBorrow(
    user,
    depositToken,
    depositUnderlying,
    borrowToken,
    depositAmount,
    borrowAmount
  ) {
    // Underlying approves to iToken
    await depositUnderlying.connect(user).approve(depositToken.address, MAX);
    // Deposit iToken
    await depositToken.connect(user).mint(user.address, depositAmount);
    // Use iToken as collateral
    await controller.connect(user).enterMarkets([depositToken.address]);
    // Borrow iToken
    await borrowToken.connect(user).borrow(borrowAmount);
  }

  before(async function () {
    ({
      controller,
      owner,
      accounts,
      iETH,
      iUSDx, // decimals: 18
      iUSDT,
      rewardDistributor,
      USDx,
      USDT,
    } = await loadFixture(fixtureDefault));

    const depositor = accounts[10];
    const depositor11 = accounts[11];
    depositor1 = accounts[1];
    depositor2 = accounts[2];

    // Deposit some USDT.
    await USDT.connect(depositor).approve(iUSDT.address, MAX);
    await iUSDT
      .connect(depositor)
      .mint(depositor.address, utils.parseUnits("100000000", 6));
    await USDT.connect(depositor1).approve(iUSDT.address, MAX);
    await iUSDT
      .connect(depositor11)
      .mint(depositor11.address, utils.parseUnits("100000000", 6));

    const depositor1SupplyAmount = utils.parseEther("3000");
    const depositor2SupplyAmount = utils.parseEther("6000");

    const depositor1BorrowAmount = utils.parseUnits("100", 6);
    const depositor2BorrowAmount = utils.parseUnits("400", 6);

    await executeBatch([
      depositAndBorrow(
        depositor1,
        iUSDx,
        USDx,
        iUSDT,
        depositor1SupplyAmount,
        depositor1BorrowAmount
      ),
      depositAndBorrow(
        depositor2,
        iUSDx,
        USDx,
        iUSDT,
        depositor2SupplyAmount,
        depositor2BorrowAmount
      ),
    ]);

    const Token = await ethers.getContractFactory("Token");
    DF = await Token.deploy("DF", "DF", 18);
    await DF.deployed();

    const treasury = await deployTreasuryAndConfig(
      DF.address,
      rewardDistributor
    );

    // Prepare reward
    await DF.mint(treasury.address, utils.parseEther("10000000000"));
    await rewardDistributor._setRewardToken(DF.address);

    // Unpause reward
    await rewardDistributor._unpause(
      [iUSDT.address], // _borrowiTokens
      [utils.parseEther("5")], // _borrowSpeeds,
      [iUSDx.address], // _supplyiTokens,
      [utils.parseEther("3")] // _supplySpeeds
    );
  });

  it("Distribute rewards on V1", async function () {
    const increaseBlockNum = 500;
    await increaseBlock(increaseBlockNum);

    // Claim rewards by supplying.
    let beforeDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    let beforeDepositor2RewardAmount = await DF.balanceOf(depositor2.address);
    await rewardDistributor.claimReward(
      [depositor1.address, depositor2.address],
      [iUSDx.address]
    );

    let afterDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    let afterDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    expect(
      afterDepositor2RewardAmount
        .sub(beforeDepositor2RewardAmount)
        .div(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount))
    ).to.be.eq(2);

    // Claimed, so increase one block.
    expect(
      (await rewardDistributor.distributionSupplySpeed(iUSDx.address))
        .mul(1)
        .div(3)
        .mul(increaseBlockNum + 1)
    ).to.be.eq(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount));
    expect(
      (await rewardDistributor.distributionSupplySpeed(iUSDx.address))
        .mul(2)
        .div(3)
        .mul(increaseBlockNum + 1)
    ).to.be.eq(afterDepositor2RewardAmount.sub(beforeDepositor2RewardAmount));

    // Claim rewards by borrowing.
    beforeDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    beforeDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    await rewardDistributor.claimReward(
      [depositor1.address, depositor2.address],
      [iUSDT.address]
    );

    afterDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    afterDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    expect(
      afterDepositor2RewardAmount
        .sub(beforeDepositor2RewardAmount)
        .div(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount))
    ).to.be.eq(4);

    // Claim twice, so increase two blocks.
    expect(
      (await rewardDistributor.distributionSpeed(iUSDT.address))
        .mul(1)
        .div(5)
        .mul(increaseBlockNum + 2)
    ).to.be.eq(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount));
    expect(
      (await rewardDistributor.distributionSpeed(iUSDT.address))
        .mul(4)
        .div(5)
        .mul(increaseBlockNum + 2)
    ).to.be.eq(afterDepositor2RewardAmount.sub(beforeDepositor2RewardAmount));
  });

  it("Update to V2", async function () {
    controller = await upgradeToV2({
      controller: controller,
      iETH: iETH,
      owner: owner,
      rewardDistributor: rewardDistributor,
    });

    const passTime = 500;
    await increaseTime(passTime);
    await increaseBlock(1);

    // Claim rewards by supplying.
    let beforeDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    let beforeDepositor2RewardAmount = await DF.balanceOf(depositor2.address);
    await rewardDistributor.claimReward(
      [depositor1.address, depositor2.address],
      [iUSDx.address]
    );
    let afterDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    let afterDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    expect(
      afterDepositor2RewardAmount
        .sub(beforeDepositor2RewardAmount)
        .div(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount))
    ).to.be.eq(2);

    // Increase 1 second by claiming.
    expect(
      (await rewardDistributor.distributionSupplySpeed(iUSDx.address))
        .mul(1)
        .div(3)
        .mul(passTime + 1)
    ).to.be.eq(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount));
    expect(
      (await rewardDistributor.distributionSupplySpeed(iUSDx.address))
        .mul(2)
        .div(3)
        .mul(passTime + 1)
    ).to.be.eq(afterDepositor2RewardAmount.sub(beforeDepositor2RewardAmount));

    // Claim rewards by borrowing.
    beforeDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    beforeDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    await rewardDistributor.claimReward(
      [depositor1.address, depositor2.address],
      [iUSDT.address]
    );

    afterDepositor1RewardAmount = await DF.balanceOf(depositor1.address);
    afterDepositor2RewardAmount = await DF.balanceOf(depositor2.address);

    expect(
      afterDepositor2RewardAmount
        .sub(beforeDepositor2RewardAmount)
        .div(afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount))
    ).to.be.eq(4);

    // Claim twice, so increase 2 second at here.
    expect(
      (await rewardDistributor.distributionSpeed(iUSDT.address))
        .mul(1)
        .div(5)
        .mul(passTime + 2)
    ).to.closeTo(
      afterDepositor1RewardAmount.sub(beforeDepositor1RewardAmount),
      1004000002100
    );
    expect(
      (await rewardDistributor.distributionSpeed(iUSDT.address))
        .mul(4)
        .div(5)
        .mul(passTime + 2)
    ).to.closeTo(
      afterDepositor2RewardAmount.sub(beforeDepositor2RewardAmount),
      4016000008100
    );
  });
});
