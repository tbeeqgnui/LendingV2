// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../TokenBase/InterestUnit.sol";

abstract contract Timestamp is InterestUnit {
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
}
