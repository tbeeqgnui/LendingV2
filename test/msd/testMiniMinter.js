const { expect } = require("chai");
const { ethers } = require("ethers");
const { loadFixture, fixtureDefault } = require("../helpers/fixtures.js");

describe.skip("Test for Mini Minter", function () {
  // common variables
  let USX, msdController, miniMinter;
  let accounts, owner;
  let amount = ethers.utils.parseEther("10000");

  before(async function () {
    ({ USX, msdController, owner, miniMinter } = await loadFixture(
      fixtureDefault
    ));

    // Operator needs to approve USX for the MiniMinter
    await USX.approve(miniMinter.address, ethers.constants.MaxUint256);
  });

  it("Should be able to borrow MSD", async function () {
    await expect(() =>
      miniMinter.connect(owner).borrow(amount)
    ).to.changeTokenBalance(USX, owner, amount);
  });

  it("Should be able to repay MSD", async function () {
    await expect(() =>
      miniMinter.connect(owner).repayBorrow(amount)
    ).to.changeTokenBalance(USX, owner, amount.mul(-1));
  });
});
