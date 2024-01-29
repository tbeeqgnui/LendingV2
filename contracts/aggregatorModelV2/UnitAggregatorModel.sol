// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";

import "./AggregatorModelV2.sol";

import "./interface/IChainlinkAggregator.sol";

contract UnitAggregatorModel is AggregatorModelV2 {
    using SignedSafeMathUpgradeable for int256;

    IChainlinkAggregator private immutable assetAggregator;

    int256 private constant BASE = 1 ether;
    int256 private constant unit = 31103476800000000000;

    constructor(IChainlinkAggregator _assetAggregator) public {
        assetAggregator = _assetAggregator;
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external override returns (uint256 _assetPrice, uint8 _decimals) {
        _asset;
        (, int256 _assetAggregatorPrice, , , ) = assetAggregator
            .latestRoundData();
        if (_assetAggregatorPrice > 0)
            _assetPrice = uint256(_assetAggregatorPrice.mul(BASE).div(unit));

        _decimals = assetAggregator.decimals();
    }

    /**
     * @notice represents the number of decimals the aggregator responses represent.
     * @return The decimal point of the aggregator.
     */
    function decimals() external view returns (uint8) {
        return assetAggregator.decimals();
    }

    /**
     * @notice the version number representing the type of aggregator the proxy points to.
     * @return The aggregator version is uint256(-1).
     */
    function version() external view override returns (uint256) {
        return uint256(-1);
    }

    /**
     * @dev Used to query the source address of the aggregator.
     * @return Asset aggregator address.
     */
    function getAggregators() external view returns (IChainlinkAggregator) {
        return assetAggregator;
    }

    /**
     * @notice returns the description of the aggregator the proxy points to.
     */
    function description() external view returns (string memory) {
        return assetAggregator.description();
    }
}
