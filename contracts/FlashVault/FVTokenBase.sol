// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";

import "../TokenBase/Base.sol";
import "../interface/IFlashVault.sol";
import "../interface/IRewardDistributorV3.sol";
import "../interface/IiToken.sol";
import "../library/Whitelists.sol";

/**
 * @title dForce's Lending Protocol Contract.
 * @notice Flash Vault iTokens which wrap a protocol token underlying.
 * @author dForce Team.
 */
abstract contract FVTokenBase is Base, Whitelists {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Expects to call only once to initialize a new market.
     * @param _underlyingToken The underlying token address.
     * @param _name Token name.
     * @param _symbol Token symbol.
     * @param _controller Core controller contract address.
     * @param _interestRateModel Token interest rate model contract address.
     */
    function __FVTokenBase_init(
        address _underlyingToken,
        string memory _name,
        string memory _symbol,
        IController _controller,
        IInterestRateModel _interestRateModel
    ) internal {
        require(
            address(_underlyingToken) != address(0),
            "initialize: underlying address should not be zero address!"
        );
        require(
            address(_controller) != address(0),
            "initialize: controller address should not be zero address!"
        );
        require(
            address(_interestRateModel) != address(0),
            "initialize: interest model address should not be zero address!"
        );
        _initialize(
            _name,
            _symbol,
            ERC20(_underlyingToken).decimals(),
            _controller,
            _interestRateModel
        );

        underlying = IERC20Upgradeable(_underlyingToken);
    }

    /**
     * @notice In order to support deflationary token, returns the changed amount.
     * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom`.
     */
    function _doTransferIn(
        address _sender,
        uint256 _amount
    ) internal virtual override returns (uint256) {
        uint256 _balanceBefore = underlying.balanceOf(address(this));
        underlying.safeTransferFrom(_sender, address(this), _amount);
        return underlying.balanceOf(address(this)).sub(_balanceBefore);
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transfer`.
     */
    function _doTransferOut(
        address payable _recipient,
        uint256 _amount
    ) internal virtual override {
        underlying.safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Gets balance of this contract in terms of the underlying
     */
    function _getCurrentCash()
        internal
        view
        virtual
        override
        returns (uint256)
    {
        return underlying.balanceOf(address(this));
    }

    /**
     * @dev Can not be called at any time.
     */
    function seize(
        address _liquidator,
        address _borrower,
        uint256 _seizeTokens
    ) external override {
        _liquidator;
        _borrower;
        _seizeTokens;
        revert("seize: Flash vault token can not be seized");
    }

    /**
     * @notice Calculates interest and update total borrows and reserves.
     * @dev Updates total borrows and reserves with any accumulated interest.
     */
    function updateInterest() external override returns (bool) {
        _updateInterest();
        return true;
    }

    /**
     * @dev Gets the newest exchange rate by accruing interest.
     */
    function exchangeRateCurrent() external virtual returns (uint256) {
        // Accrues interest.
        _updateInterest();

        return _exchangeRateInternal();
    }

    /**
     * @dev Calculates the exchange rate without accruing interest.
     */
    function exchangeRateStored()
        external
        view
        virtual
        override
        returns (uint256)
    {
        return _exchangeRateInternal();
    }

    /**
     * @dev Gets the underlying balance of the `_account`.
     * @param _account The address of the account to query.
     */
    function balanceOfUnderlying(
        address _account
    ) external virtual returns (uint256) {
        // Accrues interest.
        _updateInterest();

        return _exchangeRateInternal().rmul(balanceOf[_account]);
    }

    /**
     * @dev Gets the user's borrow balance with the latest `borrowIndex`.
     */
    function borrowBalanceCurrent(
        address _account
    ) external nonReentrant returns (uint256) {
        // Accrues interest.
        _updateInterest();

        return _borrowBalanceInternal(_account);
    }

    /**
     * @dev Gets the borrow balance of user without accruing interest.
     */
    function borrowBalanceStored(
        address _account
    ) external view override returns (uint256) {
        return _borrowBalanceInternal(_account);
    }

    /**
     * @dev Gets user borrowing information.
     */
    function borrowSnapshot(
        address _account
    ) external view returns (uint256, uint256) {
        return (
            accountBorrows[_account].principal,
            accountBorrows[_account].interestIndex
        );
    }

    /**
     * @dev Gets the current total borrows by accruing interest.
     */
    function totalBorrowsCurrent() external returns (uint256) {
        // Accrues interest.
        _updateInterest();

        return totalBorrows;
    }

    /**
     * @dev Returns the current per-block borrow interest rate.
     */
    function borrowRatePerBlock() public view returns (uint256) {
        return
            interestRateModel.getBorrowRate(
                _getCurrentCash(),
                totalBorrows,
                totalReserves
            );
    }

    /**
     * @dev Returns the current per-block supply interest rate.
     *  Calculates the supply rate:
     *  underlying = totalSupply × exchangeRate
     *  borrowsPer = totalBorrows ÷ underlying
     *  supplyRate = borrowRate × (1-reserveFactor) × borrowsPer
     */
    function supplyRatePerBlock() external view returns (uint256) {
        // `_underlyingScaled` is scaled by 1e36.
        uint256 _underlyingScaled = totalSupply.mul(_exchangeRateInternal());
        if (_underlyingScaled == 0) return 0;
        uint256 _totalBorrowsScaled = totalBorrows.mul(BASE);

        return
            borrowRatePerBlock().tmul(
                BASE.sub(reserveRatio),
                _totalBorrowsScaled.rdiv(_underlyingScaled)
            );
    }

    /**
     * @dev Get cash balance of this iToken in the underlying token.
     */
    function getCash() external view returns (uint256) {
        return _getCurrentCash();
    }

    /**
     * @dev Caller borrows assets from the protocol.
     * @param _borrower The account that will borrow tokens.
     * @param _borrowAmount The amount of the underlying asset to borrow.
     */
    function _borrowInternal(
        address payable _borrower,
        uint256 _borrowAmount
    ) internal virtual override {
        controller.beforeBorrow(address(this), _borrower, _borrowAmount);

        // Calculates the new borrower and total borrow balances:
        //  newAccountBorrows = accountBorrows + borrowAmount
        //  newTotalBorrows = totalBorrows + borrowAmount
        BorrowSnapshot storage _borrowSnapshot = accountBorrows[_borrower];
        _borrowSnapshot.principal = _borrowBalanceInternal(_borrower).add(
            _borrowAmount
        );
        _borrowSnapshot.interestIndex = borrowIndex;
        totalBorrows = totalBorrows.add(_borrowAmount);

        // Transfers token to borrower.
        _doTransferOut(_borrower, _borrowAmount);

        // Execute the callback function to do what the caller wants to do.
        IFlashVault(_borrower).executeFlashBorrow(_borrowAmount);

        controller.afterBorrow(address(this), _borrower, _borrowAmount);

        emit Borrow(
            _borrower,
            _borrowAmount,
            _borrowSnapshot.principal,
            _borrowSnapshot.interestIndex,
            totalBorrows
        );
    }

    /**
     * @notice This is a common function to flash redeem, so only one of `_redeemiTokenAmount` or
     *         `_redeemUnderlyingAmount` may be non-zero.
     * @dev Caller redeems undelying token based on the input amount of iToken or underlying token.
     * @param _from The address of the account which will spend underlying token.
     * @param _redeemiTokenAmount The number of iTokens to redeem into underlying.
     * @param _redeemUnderlyingAmount The number of underlying tokens to receive.
     */
    function _flashRedeemInternal(
        address _from,
        uint256 _redeemiTokenAmount,
        uint256 _redeemUnderlyingAmount
    ) internal virtual {
        require(
            _redeemiTokenAmount > 0,
            "_redeemInternal: Redeem iToken amount should be greater than zero!"
        );

        controller.beforeRedeem(address(this), _from, _redeemiTokenAmount);

        _burnFrom(_from, _redeemiTokenAmount);

        /**
         * Transfers `_redeemUnderlyingAmount` underlying token to caller.
         */
        _doTransferOut(msg.sender, _redeemUnderlyingAmount);

        // Execute the callback function to do what the caller want to do.
        IFlashVault(msg.sender).executeFlashRepay(_redeemUnderlyingAmount);

        controller.afterRedeem(
            address(this),
            _from,
            _redeemiTokenAmount,
            _redeemUnderlyingAmount
        );

        emit Redeem(
            _from,
            msg.sender,
            _redeemiTokenAmount,
            _redeemUnderlyingAmount
        );
    }
}
