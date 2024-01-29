// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./iToken.sol";

/**
 * @title dForce's Lending Protocol Contract.
 * @notice iTokens which wrap an EIP-20 underlying.
 * @author dForce Team.
 */
contract iTokenV2 is iToken {
    uint256 public accrualBlockTimestamp;

    function _getInterestUnit()
        internal
        view
        virtual
        override
        returns (uint256)
    {
        return block.timestamp;
    }

    function getAccrualInterestUnit()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return accrualBlockTimestamp;
    }

    function _updateAccrualInterestUnit(
        uint256 _unit
    ) internal virtual override {
        accrualBlockTimestamp = _unit;
    }

    // Record time to calculate interests later.
    function _upgrade() external onlyOwner {
        require(accrualBlockTimestamp == 0, "_upgrade: Have upgraded!");
        _updateAccrualInterestUnit(block.timestamp);
    }

    /**
     * @dev Sets a new interest rate model.
     * @param _newInterestRateModel The new interest rate model.
     */
    function _setInterestRateModel(
        IInterestRateModel _newInterestRateModel
    ) external virtual override onlyOwner {
        // Gets current interest rate model.
        IInterestRateModel _oldInterestRateModel = interestRateModel;

        // Ensures the input address is the interest model contract.
        require(
            IInterestRateSecondModelV2(address(_newInterestRateModel))
                .isInterestRateSecondModel(),
            "_setInterestRateModel: This is not the rate second model contract!"
        );

        // Set to the new interest rate model.
        interestRateModel = _newInterestRateModel;

        emit NewInterestRateModel(_oldInterestRateModel, _newInterestRateModel);
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transfer`.
     */
    function _doTransferOut(
        address payable _recipient,
        uint256 _amount
    ) internal virtual override {
        address _dst = controller.beforeTransferUnderlying(
            address(this),
            address(underlying),
            _amount,
            _recipient
        );

        underlying.safeTransfer(_dst, _amount);
    }

    function _liquidateBorrowInternal(
        address _borrower,
        uint256 _repayAmount,
        address _assetCollateral
    ) internal virtual override {
        require(
            msg.sender != _borrower,
            "_liquidateBorrowInternal: Liquidator can not be borrower!"
        );
        // According to the parameter `_repayAmount` to see what is the exact error.
        require(
            _repayAmount != 0,
            "_liquidateBorrowInternal: Liquidate amount should be greater than 0!"
        );

        // Accrues interest for collateral asset.
        Base _dlCollateral = Base(_assetCollateral);
        _dlCollateral.updateInterest();

        controller.beforeLiquidateBorrow(
            address(this),
            _assetCollateral,
            msg.sender,
            _borrower,
            _repayAmount
        );

        require(
            _dlCollateral.getAccrualInterestUnit() == _getInterestUnit(),
            "_liquidateBorrowInternal: Failed to update block timestamp in collateral asset!"
        );

        uint256 _actualRepayAmount = _repayInternal(
            msg.sender,
            _borrower,
            _repayAmount
        );

        // Calculates the number of collateral tokens that will be seized
        uint256 _seizeTokens = controller.liquidateCalculateSeizeTokensV2(
            address(this),
            _assetCollateral,
            _actualRepayAmount,
            _borrower
        );

        // If this is also the collateral, calls seizeInternal to avoid re-entrancy,
        // otherwise make an external call.
        if (_assetCollateral == address(this)) {
            _seizeInternal(address(this), msg.sender, _borrower, _seizeTokens);
        } else {
            _dlCollateral.seize(msg.sender, _borrower, _seizeTokens);
        }

        controller.afterLiquidateBorrow(
            address(this),
            _assetCollateral,
            msg.sender,
            _borrower,
            _actualRepayAmount,
            _seizeTokens
        );

        emit LiquidateBorrow(
            msg.sender,
            _borrower,
            _actualRepayAmount,
            _assetCollateral,
            _seizeTokens
        );
    }

    /**
     * @dev Caller redeems assets from the market and caller receives underlying,
     *        and exit markets.
     * @param _redeemiToken The amount of the iToken to redeem.
     */
    function redeemFromSelfAndExitMarket(
        uint256 _redeemiToken
    ) external nonReentrant settleInterest {
        _redeemInternal(
            msg.sender,
            _redeemiToken,
            _redeemiToken.rmul(_exchangeRateInternal())
        );
        controller.exitMarketFromiToken(address(this), msg.sender);
    }
}
