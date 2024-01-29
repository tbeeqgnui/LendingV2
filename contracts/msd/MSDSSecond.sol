// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./MSDS.sol";

/**
 * @title dForce's Multi-currency Stable Debt Saving Token
 * @author dForce
 */
contract MSDSSecond is MSDS {
    /**
     * @dev Block timestamp that interest was last accrued at.
     */
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
}
