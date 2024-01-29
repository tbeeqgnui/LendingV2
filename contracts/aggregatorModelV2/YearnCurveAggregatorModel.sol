// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./YearnAggregatorModel.sol";

import "./interface/ICurve.sol";

contract YearnCurveAggregatorModel is YearnAggregatorModel {
    ICurvePool internal immutable curvePool;

    // uint256 internal immutable double;

    constructor(
        IChainlinkAggregator _assetAggregator,
        IYearnVault _yearnVault,
        ICurvePool _curvePool
    ) public YearnAggregatorModel(_assetAggregator, _yearnVault) {
        curvePool = _curvePool;
        // double = 10 ** (_yearnVault.decimals() * 2);
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
            _assetPrice = uint256(_assetAggregatorPrice)
                .mul(yearnVault.pricePerShare())
                .div(weiPerToken)
                .mul(curvePool.get_virtual_price())
                .div(weiPerToken);

        _decimals = assetAggregator.decimals();
    }

    /**
     * @dev Used to query the source address of the curvePool.
     * @return Asset curvePool address.
     */
    function getCurvePool() external view returns (ICurvePool) {
        return curvePool;
    }
}
