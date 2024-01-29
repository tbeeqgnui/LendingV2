const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  loadFixture,
  fixtureDefault,
  deployMiniMinter,
} = require("../helpers/fixtures.js");

const { upgradeProxy } = require("../helpers/utils");

describe.skip("Test for L1 Bridge Operator", function () {
  let USX, l1Gateway, l1BridgeOperator, l1cBridge, miniMinter;

  before(async function () {
    ({ USX, l1Gateway, l1BridgeOperator, l1cBridge, miniMinter } =
      await loadFixture(fixtureDefault));

    await miniMinter._setPendingOwner(l1BridgeOperator.address);
    await l1BridgeOperator.acceptOwner();
  });

  it("Should be able to deposit to L1 Gateway", async function () {
    const amount = ethers.utils.parseEther("100000000");
    const maxGas = 1000000;
    const gasPriceBid = ethers.utils.parseUnits("10", "gwei");
    const data = "0x";

    await l1BridgeOperator.depositToBridge(amount, maxGas, gasPriceBid, data);

    expect(await USX.balanceOf(l1Gateway.address)).to.eq(amount);
  });

  it("Should be able to deposit to L1 cBridge", async function () {
    const amount = ethers.utils.parseEther("100000000");

    await l1BridgeOperator.depositToCBridge(amount);

    expect(await USX.balanceOf(l1cBridge.address)).to.eq(amount);
  });
});

describe.skip("Test for BSC Operator upgrade", function () {
  let USX, bscOperator, l1cBridge, miniMinter;
  let oldiMToken, oldUnderlying, oldiToken, oldiiToken, oldControllerFlashVault;

  async function upgradeBSCOperator(
    bscOperator,
    l1cBridge,
    msdController,
    USX
  ) {
    // deploy a new MiniMinter
    const miniMinter = await deployMiniMinter(USX, msdController);

    await msdController._addMinters(
      USX.address,
      [miniMinter.address],
      [ethers.utils.parseEther("10000000000")]
    );

    // upgrade the BSC Operator
    const BSCOperator = await ethers.getContractFactory("BSCOperator");

    bscOperator = await upgradeProxy(bscOperator.address, BSCOperator, {
      unsafeAllowCustomTypes: true,
    });

    // Should call upgradeAndCall
    await bscOperator.upgrade(
      USX.address,
      miniMinter.address,
      l1cBridge.address
    );

    await miniMinter._setPendingOwner(bscOperator.address);
    await bscOperator.acceptOwner();

    return { miniMinter, bscOperator };
  }

  before(async function () {
    ({
      USX,
      l1cBridge,
      msdController,
      flashMinter: bscOperator,
    } = await loadFixture(fixtureDefault));

    oldiMToken = await bscOperator.iMToken();
    oldUnderlying = await bscOperator.underlying();
    oldiToken = await bscOperator.iToken();
    oldiiToken = await bscOperator.iiToken();
    oldControllerFlashVault = await bscOperator.controllerFlashVault();

    ({ miniMinter, bscOperator } = await upgradeBSCOperator(
      bscOperator,
      l1cBridge,
      msdController,
      USX
    ));
  });

  it("Should not break any storage", async function () {
    const newiMToken = await bscOperator.iMToken();
    const newUnderlying = await bscOperator.underlying();
    const newiToken = await bscOperator.iToken();
    const newiiToken = await bscOperator.iiToken();
    const newControllerFlashVault = await bscOperator.controllerFlashVault();

    expect(newiMToken).to.eq(oldiMToken);
    expect(newUnderlying).to.eq(oldUnderlying);
    expect(newiToken).to.eq(oldiToken);
    expect(newiiToken).to.eq(oldiiToken);
    expect(newControllerFlashVault).to.eq(oldControllerFlashVault);
  });

  it("Should set the new storage", async function () {
    const newUSX = await bscOperator.USX();
    const newVault = await bscOperator.vault();
    const newCBridge = await bscOperator.cBridge();

    expect(newUSX).to.eq(USX.address);
    expect(newVault).to.eq(miniMinter.address);
    expect(newCBridge).to.eq(l1cBridge.address);
  });

  it("Should be able to deposit to L1 cBridge", async function () {
    const amount = ethers.utils.parseEther("100000000");

    await bscOperator.depositToCBridge(amount);

    expect(await USX.balanceOf(l1cBridge.address)).to.eq(amount);
  });

  it("Should be able to flashBorrow & flashRepayUnderlying", async function () {
    let amount = ethers.utils.parseEther("1000");

    await bscOperator.flashBorrow(amount);
    await bscOperator.flashRepayUnderlying(amount);
  });
});
