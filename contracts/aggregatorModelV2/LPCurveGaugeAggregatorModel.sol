// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./LPCurveBaseAggregatorModel.sol";

contract LPCurveGaugeAggregatorModel is LPCurveBaseAggregatorModel {
    constructor(IiToken _iETH) public LPCurveBaseAggregatorModel(_iETH) {}

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external override returns (uint256 _assetPrice, uint8 _decimals) {
        IiToken _iToken = IiToken(_asset);
        _assetPrice = _getPrice(
            _iToken.controller().priceOracle(),
            ILPCurve(ICurveGauge(_iToken.underlying()).lp_token())
        );
        _decimals = _iToken.decimals();
        _decimals = doubleDecimals > _decimals ? doubleDecimals - _decimals : 0;
    }
}
