//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IYearnVault {
    function pricePerShare() external view returns (uint256);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint256);
}
