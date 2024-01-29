// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "./library/SqrtMath.sol";

import "./AggregatorModelV2.sol";

import "./interface/IDODO.sol";
import "./interface/IDForceLending.sol";

contract LPDODOAggregatorModel is AggregatorModelV2 {
    using SafeMathUpgradeable for uint256;
    using SqrtMath for uint256;

    uint8 internal constant doubleDecimals = 36;

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external virtual override returns (uint256 _assetPrice, uint8 _decimals) {
        IiToken _iToken = IiToken(_asset);
        _assetPrice = _getPrice(
            _iToken.controller().priceOracle(),
            IDSP(_iToken.underlying())
        );
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
     * @notice Retrieves price of an asset.
     * @dev Get price for an asset.
     * @param _priceOracle address of priceOracle to get asset price.
     * @param _dlp Asset for which to get the price.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function getLpTokenPrice(
        IPriceOracle _priceOracle,
        IDSP _dlp
    ) external returns (uint256) {
        return _getPrice(_priceOracle, _dlp);
    }

    /**
     * @notice Retrieves price of an asset.
     * @dev Get price for an asset.
     * @param _priceOracle address of priceOracle to get asset price.
     * @param _dlp LP asset for which to get the price.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function _getPrice(
        IPriceOracle _priceOracle,
        IDSP _dlp
    ) internal returns (uint256) {
        (uint256 _baseReserve, uint256 _quoteReserve) = _dlp.getVaultReserve();
        return
            _calcLpPrice(
                _baseReserve,
                _quoteReserve,
                _priceOracle.getUnderlyingPrice(IiToken(_dlp._BASE_TOKEN_())),
                _priceOracle.getUnderlyingPrice(IiToken(_dlp._QUOTE_TOKEN_())),
                _dlp.totalSupply()
            );
    }

    /**
     * @notice Only for LP asset.
     * @dev Calculate the price of LP asset.
     * @param _reserve0 the amount of token0 in LP asset.
     * @param _reserve1 the amount of token1 in LP asset.
     * @param _price0 the price of token0.
     * @param _price1 the price of token1.
     * @param _totalSupply totalSupply of LP asset.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function _calcLpPrice(
        uint256 _reserve0,
        uint256 _reserve1,
        uint256 _price0,
        uint256 _price1,
        uint256 _totalSupply
    ) internal pure returns (uint256) {
        if (_totalSupply == 0) return 0;

        return
            (_reserve0.mul(_reserve1).sqrt().mul(_price0.mul(_price1).sqrt()) /
                _totalSupply).mul(2);
    }
}
