// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../MiniPool/ControllerMiniPool.sol";

/**
 * @title dForce's lending flash vault controller Contract
 * @author dForce team
 */
contract ControllerFlashVault is ControllerMiniPool {
    /*********************************/
    /******** Policy Hooks **********/
    /*********************************/

    /**
     * @notice Hook function before iToken `redeem()`
     * Checks if the account should be allowed to redeem the given iToken
     * Will `revert()` if any check fails
     * @param _iToken The iToken to check the redeem against
     * @param _redeemer The account which would redeem iToken
     * @param _redeemAmount The amount of iToken to redeem
     */
    function beforeRedeem(
        address _iToken,
        address _redeemer,
        uint256 _redeemAmount
    ) external override {
        // _redeemAllowed below will check whether _iToken is listed

        require(!markets[_iToken].redeemPaused, "Token redeem has been paused");

        _checkiTokenListed(_iToken);

        _redeemer;
        _redeemAmount;
    }

    /**
     * @notice Hook function after iToken `redeem()`
     * Will `revert()` if any operation fails
     * @param _iToken The iToken being redeemed
     * @param _redeemer The account which redeemed iToken
     * @param _redeemAmount  The amount of iToken being redeemed
     * @param _redeemedUnderlying The amount of underlying being redeemed
     */
    function afterRedeem(
        address _iToken,
        address _redeemer,
        uint256 _redeemAmount,
        uint256 _redeemedUnderlying
    ) external override {
        // Ideally, the redeemer has repayed borrowed asset, so check the equdity of the redeemer.
        (, uint256 _shortfall, , ) = calcAccountEquity(_redeemer);

        require(_shortfall == 0, "afterRedeem: Account has shortfall!");

        _iToken;
        _redeemer;
        _redeemAmount;
        _redeemedUnderlying;
    }

    /**
     * @notice Hook function before iToken `borrow()`
     * Checks if the account should be allowed to borrow the given iToken
     * Will `revert()` if any check fails
     * @param _iToken The iToken to check the borrow against
     * @param _borrower The account which would borrow iToken
     * @param _borrowAmount The amount of underlying to borrow
     */
    function beforeBorrow(
        address _iToken,
        address _borrower,
        uint256 _borrowAmount
    ) external override {
        _checkiTokenListed(_iToken);

        Market storage _market = markets[_iToken];
        require(!_market.borrowPaused, "Token borrow has been paused");

        if (!hasBorrowed(_borrower, _iToken)) {
            // Unlike collaterals, borrowed asset can only be added by iToken,
            // rather than enabled by user directly.
            require(msg.sender == _iToken, "sender must be iToken");

            // Have checked _iToken is listed, just add it
            _addToBorrowed(_borrower, _iToken);
        }

        // Check the iToken's borrow capacity, -1 means no limit
        uint256 _totalBorrows = IiToken(_iToken).totalBorrows();
        require(
            _totalBorrows.add(_borrowAmount) <= _market.borrowCapacity,
            "Token borrow capacity reached"
        );
    }

    /**
     * @notice Hook function after iToken `borrow()`
     * Will `revert()` if any operation fails
     * @param _iToken The iToken being borrewd
     * @param _borrower The account which borrowed iToken
     * @param _borrowedAmount  The amount of underlying being borrowed
     */
    function afterBorrow(
        address _iToken,
        address _borrower,
        uint256 _borrowedAmount
    ) external override {
        // Ideally, the borrower has deposited collaterl, so check the equdity of the borrower.
        (, uint256 _shortfall, , ) = calcAccountEquity(_borrower);

        require(_shortfall == 0, "afterBorrow: Account has shortfall!");

        _iToken;
        _borrower;
        _borrowedAmount;
    }
}
