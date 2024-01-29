// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

abstract contract InterestUnit {
    function _getInterestUnit() internal view virtual returns (uint256) {}

    function getAccrualInterestUnit() public view virtual returns (uint256) {}

    function _updateAccrualInterestUnit(uint256 _unit) internal virtual {}
}
