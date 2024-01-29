//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IAssetPriceModel {
    function getAssetPrice(address _asset) external returns (uint256);
}
