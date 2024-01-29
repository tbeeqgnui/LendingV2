const { expect } = require("chai");
const { utils, BigNumber, ethers } = require("ethers");
const {
  loadFixture,
  fixtureDefault,
  increaseBlock,
  increaseTime,
} = require("../helpers/fixtures.js");

describe.skip("Test for iMSD Flash Mint", function () {
  // common variables
  let USX,
    iUSX,
    iiUSX,
    iMUSXFlashMint,
    flashMinter,
    controllerFlashMint,
    priceOracle;
  let accounts, owner;
  let iToken, underlying;

  before(async function () {
    ({
      USX,
      iUSX,
      iiUSX,
      iMUSXFlashMint,
      flashMinter,
      accounts,
      controllerFlashMint,
      priceOracle,
      controller,
      msdController,
      owner,
      iUSDx: iToken,
      USDx: underlying,
    } = await loadFixture(fixtureDefault));
  });

  it.skip("Generate interests", async function () {
    let mintAmount = ethers.utils.parseEther("99999999");
    await USX._addMinter(owner.address);
    await USX.mint(owner.address, mintAmount);

    await USX.approve(iUSX.address, ethers.utils.parseEther("99999999"));
    await iUSX.mint(owner.address, ethers.utils.parseEther("100000"));
    await controller.connect(owner).enterMarkets([iUSX.address]);
    await iUSX.borrow(ethers.utils.parseEther("50000"));

    // pass 100 blocks
    await increaseBlock(100);
    await increaseTime(100);

    await iUSX.exchangeRateCurrent();
    console.log(
      "exchange rate is: ",
      (await iUSX.exchangeRateStored()).toString()
    );
  });

  it("Make a flash borrow successfully.", async function () {
    let borrowAmount = utils.parseEther("1000");
    await flashMinter.flashBorrow(borrowAmount);

    let iiTokenBalance = await iiUSX.balanceOf(flashMinter.address);
    expect(iiTokenBalance).to.be.equal(borrowAmount);
    let iMTokenBalance = await iMUSXFlashMint.borrowBalanceStored(
      flashMinter.address
    );
    expect(iMTokenBalance).to.be.equal(borrowAmount);
  });

  it("Make a flash redeem underlying successfully.", async function () {
    let redeemAmount = utils.parseEther("50");
    // cause the borrowed amount is 1000.
    let expectedAmount = utils.parseEther("950");
    await flashMinter.flashRepayUnderlying(redeemAmount);
    let iiTokenBalance = await iiUSX.balanceOf(flashMinter.address);
    expect(iiTokenBalance).to.be.equal(expectedAmount);
    let iMTokenBalance = await iMUSXFlashMint.borrowBalanceStored(
      flashMinter.address
    );
    expect(iMTokenBalance).to.be.equal(expectedAmount);
  });
});
