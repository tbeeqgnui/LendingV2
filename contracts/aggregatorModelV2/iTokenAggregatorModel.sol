// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../library/SafeRatioMath.sol";

import "./AggregatorModelV2.sol";

import "./interface/IDForceLending.sol";

contract iTokenAggregatorModel is AggregatorModelV2 {
    using SafeMathUpgradeable for uint256;
    using SafeRatioMath for uint256;

    uint256 internal constant initialExchangeRate = 1 ether;
    uint8 internal constant doubleDecimals = 36;

    function _getInterestUnit() internal view virtual returns (uint256) {
        return block.number;
    }

    struct InterestLocalVars {
        uint256 currentInterestUnit;
        uint256 accrualInterestUnit;
        uint256 interestAccumulated;
        uint256 cash;
        uint256 totalBorrows;
        uint256 totalReserves;
    }

    /**
     * @notice Calculates total borrows and reserves.
     * @dev Get the current total borrows and reserves with any accumulated interest.
     * @param _iToken dForceLending iToken address.
     * @return iToken current cash.
     *         iToken current total borrows.
     *         iToken current reserves.
     */
    function _getITokenCurrentData(
        IiToken _iToken
    ) internal view returns (uint256, uint256, uint256) {
        InterestLocalVars memory _vars;
        _vars.cash = _iToken.getCash();
        _vars.totalBorrows = _iToken.totalBorrows();
        _vars.totalReserves = _iToken.totalReserves();

        _vars.currentInterestUnit = _getInterestUnit();
        _vars.accrualInterestUnit = _iToken.getAccrualInterestUnit();
        if (_vars.currentInterestUnit > _vars.accrualInterestUnit) {
            _vars.interestAccumulated = _iToken
                .borrowRatePerBlock()
                .mul(_vars.currentInterestUnit - _vars.accrualInterestUnit)
                .rmul(_vars.totalBorrows);
            _vars.totalBorrows = _vars.interestAccumulated.add(
                _vars.totalBorrows
            );
            _vars.totalReserves = _iToken
                .reserveRatio()
                .rmul(_vars.interestAccumulated)
                .add(_vars.totalReserves);
        }

        return (_vars.cash, _vars.totalBorrows, _vars.totalReserves);
    }

    /**
     * @notice Calculates current exchangeRate.
     * @param _iToken dForceLending iToken address.
     * @return iToken current exchangeRate.
     */
    function _getITokenCurrentExchangeRate(
        IiToken _iToken
    ) internal view returns (uint256) {
        uint256 _totalSupply = _iToken.totalSupply();
        if (_totalSupply == 0) {
            return initialExchangeRate;
        } else {
            (
                uint256 _cash,
                uint256 _totalBorrows,
                uint256 _totalReserves
            ) = _getITokenCurrentData(_iToken);
            return
                _cash.add(_totalBorrows).sub(_totalReserves).rdiv(_totalSupply);
        }
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external virtual override returns (uint256 _assetPrice, uint8 _decimals) {
        IiToken _iToken = IiToken(IiToken(_asset).underlying());
        _getITokenCurrentExchangeRate(_iToken);
        _assetPrice = _iToken
            .controller()
            .priceOracle()
            .getUnderlyingPrice(_iToken)
            .rmul(_getITokenCurrentExchangeRate(_iToken));

        _decimals = IiToken(_asset).decimals();
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
     * @notice Used to query current exchangeRate.
     * @param _iToken dForceLending iToken address.
     * @return iToken current exchangeRate.
     */
    function getITokenCurrentExchangeRate(
        IiToken _iToken
    ) external view returns (uint256) {
        return _getITokenCurrentExchangeRate(_iToken);
    }

    /**
     * @notice Used to query iToken current data.
     * @param _iToken dForceLending iToken address.
     * @return iToken current cash.
     *         iToken current total borrows.
     *         iToken current reserves.
     */
    function getITokenCurrentData(
        IiToken _iToken
    ) external view returns (uint256, uint256, uint256) {
        return _getITokenCurrentData(_iToken);
    }
}
