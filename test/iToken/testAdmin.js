const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");

const {
  loadFixture,
  increaseBlock,
  fixtureDefault,
} = require("../helpers/fixtures.js");

const MockController = require("../../artifacts/contracts/Controller.sol/Controller.json");
const MockInterestRateModel = require("../../artifacts/contracts/InterestRateModel/InterestRateModel.sol/InterestRateModel.json");

const zeroAddress = ethers.constants.AddressZero;

let iToken, iUSDT, controller, interestRateModel;
let underlying, USDT;
let users, user1, user2, user3, owner;
let oracle;
let iTokenDecimals, iUSDTDecimals;
let actualiTokenMintAmount, actualiUSDTMintAmount;
let beforeController, mockController;
let beforeInterestRateModel, mockInterestRateModel;

describe("iToken", function () {
  const rawMintAmount = ethers.BigNumber.from("500");

  async function init() {
    ({
      controller: controller,
      owner: owner,
      iUSDx: iToken,
      USDx: underlying,
      iUSDT: iUSDT,
      USDT: USDT,
      interestRateModel: interestRateModel,
      accounts: users,
      flashloanExecutor: flashloanExecutor,
      flashloanExecutorFailure: flashloanExecutorFailure,
      priceOracle: oracle,
    } = await loadFixture(fixtureDefault));
    [user1, user2, user3] = users;
    await controller
      .connect(user1)
      .enterMarkets([iToken.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iToken.address, iUSDT.address]);
    await controller.connect(user3).enterMarkets([iUSDT.address]);
    iTokenDecimals = await iToken.decimals();
    actualiTokenMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iTokenDecimals)
    );
    iUSDTDecimals = await iUSDT.decimals();
    actualiUSDTMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iUSDTDecimals)
    );
    await iToken.connect(user1).mint(user1.address, actualiTokenMintAmount);
    await iToken.connect(user2).mint(user2.address, actualiTokenMintAmount);
    await iUSDT.connect(user1).mint(user1.address, actualiUSDTMintAmount);
    await iUSDT.connect(user2).mint(user2.address, actualiUSDTMintAmount);
    await iUSDT.connect(user3).mint(user3.address, actualiUSDTMintAmount);

    beforeController = iToken.controller();
    beforeInterestRateModel = iToken.interestRateModel();

    mockController = await deployMockContract(owner, MockController.abi);
    await mockController.mock.isController.returns(true);

    mockInterestRateModel = await deployMockContract(
      owner,
      MockInterestRateModel.abi
    );
    await mockInterestRateModel.mock.isInterestRateModel.returns(true);
  }

  describe("Test all scenarios for setNewReserveRatio:", async function () {
    it("ITKN-SRSV-0: Should set new reserve ratio", async function () {
      await init();
      const newReserveRatio = ethers.utils.parseEther("0.7545");

      await iToken.connect(owner)._setNewReserveRatio(newReserveRatio);
      let currentReserveRatio = await iToken.reserveRatio();

      expect(currentReserveRatio).to.equal(newReserveRatio);
    });

    it("ITKN-SRSV-1: Should revert when caller is not owner", async function () {
      const newReserveRatio = ethers.utils.parseEther("0.1");
      await expect(
        iToken.connect(user1)._setNewReserveRatio(newReserveRatio)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("ITKN-SRSV-2: Should revert due to new reserve ratio is too large", async function () {
      const newReserveRatio = ethers.utils.parseEther("2");
      await expect(
        iToken.connect(owner)._setNewReserveRatio(newReserveRatio)
      ).to.be.revertedWith("_setNewReserveRatio: New reserve ratio too large!");
    });
  });

  describe("Test all scenarios for _setController", async function () {
    it("ITKN-SCTL-0: Should set new controller", async function () {
      await init();

      await iToken._setController(mockController.address);

      let afterController = await iToken.controller();

      expect(mockController.address).to.equal(afterController);
      expect(afterController).to.not.equal(beforeController);

      await iToken._setController(controller.address);
    });

    it("ITKN-SCTL-1: Should revert when caller is not owner", async function () {
      await expect(
        iToken.connect(user3)._setController(mockController.address)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("ITKN-SCTL-2: Should revert when the contract is not a controller contract", async function () {
      await expect(iToken._setController(user3.address)).to.be.reverted;
    });
  });

  describe("Test all scenarios for _setInterestRateModel", async function () {
    it("ITKN-SIRM-0: Should set interest rate model correctly", async function () {
      await init();

      await iToken._setInterestRateModel(mockInterestRateModel.address);

      let afterInterestRateModel = await iToken.interestRateModel();

      expect(mockInterestRateModel.address).to.equal(afterInterestRateModel);
      expect(afterInterestRateModel).to.not.equal(beforeInterestRateModel);
    });

    it("ITKN-SIRM-1: Should revert when caller is not the owner", async function () {
      await expect(
        iToken
          .connect(user3)
          ._setInterestRateModel(mockInterestRateModel.address)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("ITKN-SIRM-2: Should revert due to set a non interest model contract", async function () {
      await expect(iToken._setInterestRateModel(user3.address)).to.be.reverted;
    });
  });

  describe("Test all scenarios for _setNewFlashloanFeeRatio", async function () {
    it("Should set new flashloan fee ratio correctly", async function () {
      await init();
      const newFlashloanFeeRatio = ethers.utils.parseEther("0.0007545");
      await iToken._setNewFlashloanFeeRatio(newFlashloanFeeRatio);
      const currentFlashloanFeeRatio = await iToken.flashloanFeeRatio();

      expect(currentFlashloanFeeRatio).to.equal(newFlashloanFeeRatio);
    });

    it("Should revert when caller is not the owner", async function () {
      const newFlashloanFeeRatio = ethers.utils.parseEther("0.0007545");
      await expect(
        iToken.connect(user3)._setNewFlashloanFeeRatio(newFlashloanFeeRatio)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("Should revert due to new flashloan fee ratio is too large", async function () {
      const newFlashloanFeeRatio = ethers.utils.parseEther("2");
      await expect(
        iToken._setNewFlashloanFeeRatio(newFlashloanFeeRatio)
      ).to.be.revertedWith(
        "setNewFlashloanFeeRatio: New flashloan ratio too large!"
      );
    });
  });

  describe("Test all scenarios for _setNewProtocolFeeRatio", async function () {
    it("Should set new protocol fee ratio", async function () {
      await init();
      const newProtocolFeeRatio = ethers.utils.parseEther("0.07545");
      await iToken._setNewProtocolFeeRatio(newProtocolFeeRatio);
      const currentProtocolFeeRatio = await iToken.protocolFeeRatio();

      expect(currentProtocolFeeRatio).to.equal(newProtocolFeeRatio);
    });

    it("Should revert when caller is not the owner", async function () {
      const newProtocolFeeRatio = ethers.utils.parseEther("0.07545");
      await expect(
        iToken.connect(user3)._setNewProtocolFeeRatio(newProtocolFeeRatio)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("Should revert due to new protocol fee ratio is too large", async function () {
      const newProtocolFeeRatio = ethers.utils.parseEther("2");
      await expect(
        iToken._setNewProtocolFeeRatio(newProtocolFeeRatio)
      ).to.be.revertedWith(
        "_setNewProtocolFeeRatio: New protocol ratio too large!"
      );
    });
  });

  describe("Test all scenarios for _withdrawReserves", async function () {
    it("ITKN-RESV-0: Should withdraw reserve correctly", async function () {
      await init();
      const rawBorrowAmout = ethers.BigNumber.from("300");
      const withdrawAmount = "10";
      const iUSDTDecimals = await iUSDT.decimals();
      const actualBorrowAmount = rawBorrowAmout.mul(
        ethers.BigNumber.from("10").pow(iUSDTDecimals)
      );

      // borrow asset.
      await iUSDT.connect(user2).borrow(actualBorrowAmount);

      // mine block to accrue interest.
      await increaseBlock(1000);

      // repay asset to add total reserves.
      await iUSDT.connect(user2).repayBorrow(actualBorrowAmount.div(2));

      let currentReserves = await iUSDT.totalReserves();
      expect(currentReserves).to.gt(0);

      await expect(() =>
        iUSDT._withdrawReserves(withdrawAmount)
      ).to.be.changeTokenBalance(USDT, owner, withdrawAmount);

      expect(await iUSDT.totalReserves()).to.equal(
        currentReserves.sub(withdrawAmount)
      );
    });

    it("ITKN-RESV-1: Should revert when caller is not the owner", async function () {
      const withdrawAmount = "10";
      await expect(
        iToken.connect(user3)._withdrawReserves(withdrawAmount)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("ITKN-RESV-2: Should revert due to too much to withdraw", async function () {
      const withdrawAmount = ethers.utils.parseEther("1");
      await expect(
        iToken.connect(owner)._withdrawReserves(withdrawAmount)
      ).to.be.revertedWith(
        "_withdrawReserves: Invalid withdraw amount and do not have enough cash!"
      );
    });
  });

  describe("Test all scenarios for ownable", async function () {
    it("Should set a new pending owner correctly", async function () {
      // case1: when there does not exist a pending owner.
      let beforePendingOwner = await iToken.pendingOwner();
      expect(beforePendingOwner).to.equal(zeroAddress);
      await iToken._setPendingOwner(user3.address);
      expect(await iToken.pendingOwner()).to.equal(user3.address);

      // case2: when there already has a pending owner, set a new pending owner.
      await iToken._setPendingOwner(user2.address);
      expect(await iToken.pendingOwner()).to.equal(user2.address);
    });

    it("Should accept owner from the pending owenr correctly", async function () {
      let currentPendingOwenr = await iToken.pendingOwner();
      expect(currentPendingOwenr).to.not.equal(zeroAddress);

      await iToken.connect(user2)._acceptOwner();
      expect(await iToken.owner()).to.equal(user2.address);
      expect(await iToken.pendingOwner()).to.equal(zeroAddress);
    });

    it("Should revert due to new pending owner is zero address", async function () {
      await expect(
        iToken.connect(user2)._setPendingOwner(zeroAddress)
      ).to.be.revertedWith(
        "_setPendingOwner: New owenr can not be zero address and owner has been set!"
      );
    });

    it("Should revert due to new pending owner has been set!", async function () {
      await iToken.connect(user2)._setPendingOwner(user3.address);
      await expect(
        iToken.connect(user2)._setPendingOwner(user3.address)
      ).to.be.revertedWith(
        "_setPendingOwner: New owenr can not be zero address and owner has been set!"
      );
    });

    it("Accept owner should revert due to caller is the pending owner", async function () {
      // current pending owner is user3 due to the last case.
      await expect(iToken.connect(user2)._acceptOwner()).to.be.revertedWith(
        "_acceptOwner: Only for pending owner!"
      );
    });
  });
});
