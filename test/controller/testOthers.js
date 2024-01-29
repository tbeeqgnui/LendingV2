const { expect } = require("chai");
const { utils } = require("ethers");
const { loadFixture, fixtureDefault } = require("../helpers/fixtures.js");

describe("Controller: Mock Price Oracle", function () {
  it("Should be able to mock getUnderlyingPrice()", async function () {
    const { iUSDx, mockPriceOracle } = await loadFixture(fixtureDefault);

    let price = utils.parseEther("1");
    await mockPriceOracle.mock.getUnderlyingPrice
      .withArgs(iUSDx.address)
      .returns(price);

    expect(await mockPriceOracle.getUnderlyingPrice(iUSDx.address)).to.equal(
      price
    );
  });
});

describe("Controller: General Information", function () {
  it("Should be able to get all iTokens", async function () {
    const {
      controller,
      iUSDx,
      iUSDT,
      iWBTC,
      ixTSLA,
      ixAAPL,
      iUSDC,
      iETH,
      iMUSX,
      iMEUX,
      iUSX,
      iEUX,
      reentrancyiToken,
    } = await loadFixture(fixtureDefault);

    expect(await controller.getAlliTokens()).to.have.members([
      iUSDx.address,
      iUSDT.address,
      iWBTC.address,
      ixTSLA.address,
      ixAAPL.address,
      iUSDC.address,
      iETH.address,
      iMUSX.address,
      iMEUX.address,
      iUSX.address,
      iEUX.address,
      reentrancyiToken.address,
    ]);
  });
});
