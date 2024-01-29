// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./AggregatorModelV2.sol";

import "./interface/IDForceLending.sol";

contract RewardAggregatorModel is AggregatorModelV2 {
    IPriceOracle private immutable priceOracle;

    uint8 internal constant doubleDecimals = 36;

    constructor(IPriceOracle _priceOracle) public {
        priceOracle = _priceOracle;
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external override returns (uint256 _assetPrice, uint8 _decimals) {
        IiToken _iToken = IiToken(_asset);
        _assetPrice = priceOracle.getUnderlyingPrice(_iToken);
        _decimals = _iToken.decimals();
        _decimals = doubleDecimals > _decimals ? doubleDecimals - _decimals : 0;
    }

    /**
     * @notice the version number representing the type of aggregator the proxy points to.
     * @return The aggregator version is uint256(-1).
     */
    function version() external view override returns (uint256) {
        return uint256(-1);
    }

    /**
     * @dev Used to query the priceOracle address of the reward.
     * @return reward priceOracle address.
     */
    function rewardPriceOracle() external view returns (IPriceOracle) {
        return priceOracle;
    }
}
