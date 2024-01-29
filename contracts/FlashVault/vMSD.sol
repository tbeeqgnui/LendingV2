// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../msd/MSDController.sol";
import "../msd/MSD.sol";
import "../interface/IFlashVault.sol";

import "./FVTokenBase.sol";

/**
 * @title dForce's Lending Protocol Contract.
 * @notice dForce lending token for the Flash Vault.
 * @author dForce Team.
 */
contract vMSD is FVTokenBase {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    MSDController public msdController;

    event NewMSDController(
        MSDController oldMSDController,
        MSDController newMSDController
    );

    /**
     * @notice Expects to call only once to initialize a new market.
     * @param _underlyingToken The underlying token address.
     * @param _name Token name.
     * @param _symbol Token symbol.
     * @param _lendingController Lending controller contract address.
     * @param _interestRateModel Token interest rate model contract address.
     * @param _msdController MSD controller contract address.
     */
    function initialize(
        address _underlyingToken,
        string memory _name,
        string memory _symbol,
        IController _lendingController,
        IInterestRateModel _interestRateModel,
        MSDController _msdController
    ) external initializer {
        __FVTokenBase_init(
            _underlyingToken,
            _name,
            _symbol,
            _lendingController,
            _interestRateModel
        );
        __vMSD_init_unchained(_msdController);
    }

    function __vMSD_init_unchained(MSDController _msdController) internal {
        require(
            address(_msdController) != address(0),
            "__vMSD_init_unchained: MSD controller address should not be zero address!"
        );

        msdController = _msdController;
        reserveRatio = BASE;
    }

    /**
     * @dev Reserve ratio of iMSD is fixed to 100%.
     * All interests iMSD generated goes to reserve, this should be called when migrating
     */
    function _setNewReserveRatio(
        uint256 _newReserveRatio
    ) external override onlyOwner settleInterest {
        // Gets current reserve ratio.
        uint256 _oldReserveRatio = reserveRatio;

        // Sets new reserve ratio.
        reserveRatio = BASE;

        emit NewReserveRatio(_oldReserveRatio, BASE);

        _newReserveRatio;
    }

    /**
     * @dev Admin withdraws `_withdrawAmount` of the reserve
     * skip the default check of cash as iMSD hold 0 cash.
     * @param _withdrawAmount Amount of reserves to withdraw.
     */
    function _withdrawReserves(
        uint256 _withdrawAmount
    ) external override onlyOwner settleInterest {
        require(
            _withdrawAmount <= totalReserves,
            "_withdrawReserves: Invalid withdraw amount!"
        );

        uint256 _oldTotalReserves = totalReserves;
        // Updates total amount of the reserves.
        totalReserves = totalReserves.sub(_withdrawAmount);

        // Transfers reserve to the owner.
        _doTransferOut(owner, _withdrawAmount);

        emit ReservesWithdrawn(
            owner,
            _withdrawAmount,
            totalReserves,
            _oldTotalReserves
        );
    }

    /**
     * @dev Sets a new MSD controller.
     * @param _newMSDController The new MSD controller
     */
    function _setMSDController(
        MSDController _newMSDController
    ) external onlyOwner {
        MSDController _oldMSDController = msdController;

        // Ensures the input address is a MSDController contract.
        require(
            _newMSDController.isMSDController(),
            "_setMSDController: This is not MSD controller contract!"
        );

        msdController = _newMSDController;

        emit NewMSDController(_oldMSDController, _newMSDController);
    }

    /**
     * @notice Supposed to transfer underlying token into this contract
     * @dev iMSD burns the amount of underlying rather than transfering.
     */
    function _doTransferIn(
        address _sender,
        uint256 _amount
    ) internal override returns (uint256) {
        MSD(address(underlying)).burn(_sender, _amount);
        return _amount;
    }

    /**
     * @notice Supposed to transfer underlying token to `_recipient`
     * @dev iMSD mint the amount of underlying rather than transfering.
     * this can be called by `borrow()` and `_withdrawReserves()`
     * Reserves should stay 0 for iMSD
     */
    function _doTransferOut(
        address payable _recipient,
        uint256 _amount
    ) internal override {
        msdController.mintMSD(address(underlying), _recipient, _amount);
    }

    /**
     * @dev iMSD does not hold any underlying in cash, returning 0
     */
    function _getCurrentCash() internal view override returns (uint256) {
        return 0;
    }

    /**
     * @dev Gets the newest exchange rate by accruing interest.
     * iMSD returns the initial exchange rate 1.0
     */
    function exchangeRateCurrent() external override returns (uint256) {
        return initialExchangeRate;
    }

    /**
     * @dev Calculates the exchange rate without accruing interest.
     * iMSD returns the initial exchange rate 1.0
     */
    function exchangeRateStored() external view override returns (uint256) {
        return initialExchangeRate;
    }

    /**
     * @dev Gets the underlying balance of the `_account`.
     * @param _account The address of the account to query.
     * iMSD just returns 0
     */
    function balanceOfUnderlying(
        address _account
    ) external override returns (uint256) {
        _account;
        return 0;
    }

    /**
     * @notice Check whether is a iToken contract, return false for iMSD contract.
     */
    function isiToken() external pure override returns (bool) {
        return false;
    }

    /**
     * @notice The total mint of the underlying MSD token, queried by MSD controller.
     */
    function totalMint() external view returns (uint256) {
        return totalBorrows;
    }

    /**
     * @dev Caller repays their own borrow.
     * @param _repayAmount The amount to repay.
     */
    function repayBorrow(
        uint256 _repayAmount
    ) external nonReentrant settleInterest {
        _repayInternal(msg.sender, msg.sender, _repayAmount);
    }

    /**
     * @dev Caller repays a borrow belonging to borrower.
     * @param _borrower the account with the debt being payed off.
     * @param _repayAmount The amount to repay.
     */
    function repayBorrowBehalf(
        address _borrower,
        uint256 _repayAmount
    ) external nonReentrant settleInterest {
        _repayInternal(msg.sender, _borrower, _repayAmount);
    }

    /**
     * @notice Have permission to call this function, and it is only for the flash vault contract.
     * @dev Borrows some USX without collaterals to the flash valut contract at first, then do any actions
     *      in the flash valut contract, finally, it should deposit collaterals to ensure there is
     *      no any shortfall.
     */
    function flashBorrow(
        uint256 _borrowAmount
    ) external nonReentrant settleInterest onlyWhitelist(msg.sender) {
        require(
            _borrowAmount > 0,
            "flashBorrow: Borrow amount can not be zero!"
        );

        // Borrow out USX to flash minter contract.
        _borrowInternal(msg.sender, _borrowAmount);
    }
}
