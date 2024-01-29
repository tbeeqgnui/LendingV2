//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IFlashVault {
    function isFlashVault() external returns (bool);

    function executeFlashBorrow(uint256 amount) external;

    function executeFlashRepay(uint256 amount) external;
}
