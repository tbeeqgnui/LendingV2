// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./iTokenAggregatorModel.sol";

contract FVAggregatorModel is iTokenAggregatorModel {
    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external override returns (uint256 _assetPrice, uint8 _decimals) {
        IiToken _iToken = IiToken(IiToken(_asset).underlying());
        _getITokenCurrentExchangeRate(_iToken);
        _assetPrice = _iToken
            .controller()
            .priceOracle()
            .getUnderlyingPrice(_iToken)
            .rmul(_getITokenCurrentExchangeRate(_iToken));

        if (_assetPrice > 0) _assetPrice = _assetPrice.add(1);

        _decimals = IiToken(_asset).decimals();
        _decimals = doubleDecimals > _decimals ? doubleDecimals - _decimals : 0;
    }
}
