// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./TransitAggregatorModel.sol";

contract UnitTransitAggregatorModel is TransitAggregatorModel {
    int256 private constant BASE = 1 ether;
    int256 private constant unit = 31103476800000000000;

    constructor(
        IChainlinkAggregator _assetAggregator,
        IChainlinkAggregator _transitAggregator
    ) public TransitAggregatorModel(_assetAggregator, _transitAggregator) {}

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
        (, int256 _transitPrice, , , ) = transitAggregator.latestRoundData();
        int256 _scale = int256(10 ** uint256(transitAggregator.decimals()));
        if (_assetAggregatorPrice > 0 && _transitPrice > 0 && _scale > 0)
            _assetPrice = uint256(
                _assetAggregatorPrice
                    .mul(_transitPrice)
                    .div(_scale)
                    .mul(BASE)
                    .div(unit)
            );

        _decimals = assetAggregator.decimals();
    }
}
