//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";

import "./interface/IController.sol";
import "./interface/IPriceOracle.sol";
import "./interface/IiToken.sol";
import "./interface/IRewardDistributor.sol";
import "./interface/ITimeLockStrategy.sol";
import "./interface/IDefaultTimeLock.sol";
import "./interface/IERC20Metadata.sol";

import "./library/Initializable.sol";
import "./library/Ownable.sol";
import "./library/SafeRatioMath.sol";

import "./ControllerStock.sol";

/**
 * @title dForce's lending controller Contract
 * @author dForce
 */
abstract contract ControllerV2ExtraBase is
    Initializable,
    Ownable,
    ControllerStorageV2Extra,
    IControllerV2ExtraBase
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeRatioMath for uint256;
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /*********************************/
    /***** Internal  Functions *******/
    /*********************************/

    /******** validations *******/

    /**
     * @dev Check if _iToken is listed
     */
    function _checkiTokenListed(address _iToken) internal view {
        require(iTokens.contains(_iToken), "Token has not been listed");
    }

    /**
     * @dev Check if the _eModeID is valid
     */
    function _validateEModeID(uint8 _eModeID, uint8 validFrom) internal view {
        uint8 _totalEModes = uint8(eModes.length);
        require(
            _eModeID >= validFrom && _eModeID < _totalEModes,
            "_validateEModeID: Invalid eMode ID!"
        );
    }

    // Check if parameter `_liquidationIncentive` is valid in the eMode
    function _validateEModeLiquidationIncentive(
        uint256 _liquidationIncentive
    ) internal pure {
        require(
            _liquidationIncentive >= liquidationIncentiveMinMantissa &&
                _liquidationIncentive <= liquidationIncentiveMaxMantissa,
            "_validateEModeLiquidationIncentive: Invalid liquidation incentive!"
        );
    }

    // Check if parameter `_closeFactor` is valid in the eMode
    function _validateEModeCloseFactor(uint256 _closeFactor) internal pure {
        require(
            _closeFactor >= closeFactorMinMantissa &&
                _closeFactor <= closeFactorMaxMantissa,
            "_validateEModeCloseFactor: Invalid close factor!"
        );
    }

    // Check if parameter `_eModeLtv` is valid in the eMode
    function _validateEModeLTV(
        uint256 _collateralFactor,
        uint256 _emodeLiquidationThreshold,
        uint256 _eModeLtv
    ) internal pure {
        require(
            _eModeLtv >= _collateralFactor &&
                _eModeLtv <= _emodeLiquidationThreshold,
            "_validateEModeLTV: Invalid LTV!"
        );
    }

    // Check if parameter `_liquidationThreshold` is valid
    function _validateLiquidationThreshold(
        uint256 _ltv,
        uint256 _liquidationThreshold
    ) internal pure {
        require(
            _liquidationThreshold >= _ltv &&
                _liquidationThreshold <= collateralFactorMaxMantissa,
            "_validateLiquidationThreshold: Invalid liquidation threshold!"
        );
    }

    // Check if parameter `_collateralFactor` is valid
    function _validateCollateralFactor(
        uint256 _collateralFactor,
        uint256 _liquidationThreshold
    ) internal pure {
        // v1 has check some validation, only check against the liquidation threshold
        require(
            _collateralFactor <= _liquidationThreshold,
            "_validateCollateralFactor: Invalid collateral factor!"
        );
    }

    /******** Getters *******/

    function _getDecimals(address _iToken) internal view returns (uint256) {
        return uint256(IERC20Metadata(_iToken).decimals());
    }

    /**
     * @dev Get eMode id by iToken address.
     */
    function _getiTokenEModeID(
        address _iToken
    ) internal view returns (uint8 _iTokenEModeID) {
        MarketV2 storage _market = markets[_iToken];
        _iTokenEModeID = _market.eModeID;
    }

    function _getEffectedEMode(
        address _iToken,
        address _account
    ) internal view returns (uint8 _eModeID) {
        uint8 _accountEMode = accountsEMode[_account];
        _eModeID = _accountEMode == markets[_iToken].eModeID
            ? _accountEMode
            : 0;
    }

    /******** Setters *******/

    function _setBorrowableInIsolationInternal(
        address _iToken,
        bool _borrowable
    ) internal {
        MarketV2 storage _market = markets[_iToken];
        _market.borrowableInIsolation = _borrowable;

        emit BorrowableInIsolationChanged(_iToken, _borrowable);
    }

    function _setDebtCeilingInternal(
        address _iToken,
        uint256 _newDebtCeiling
    ) internal {
        MarketV2 storage _market = markets[_iToken];
        uint256 _oldDebtCeiling = _market.debtCeiling;

        _market.debtCeiling = _newDebtCeiling;

        emit DebtCeilingChanged(_iToken, _oldDebtCeiling, _newDebtCeiling);
    }

    function _setLiquidationThresholdInternal(
        address _iToken,
        uint256 _newLiquidationThresholdMantissa
    ) internal {
        _validateLiquidationThreshold(
            marketCollateralFactor[_iToken][0],
            _newLiquidationThresholdMantissa
        );

        uint256 _oldLiquidationThresholdMantissa = marketCollateralFactor[
            _iToken
        ][1];
        marketCollateralFactor[_iToken][1] = _newLiquidationThresholdMantissa;

        emit NewLiquidationThreshold(
            _iToken,
            _oldLiquidationThresholdMantissa,
            _newLiquidationThresholdMantissa
        );
    }

    /**
     * @dev Sets the eMode config for iToken
     */
    function _setEModeInternal(
        address _iToken,
        uint8 _newEModeID,
        uint256 _eModeLtv,
        uint256 _eModeLiqThreshold
    ) internal {
        _validateEModeID(_newEModeID, 1);

        MarketV2 storage _market = markets[_iToken];
        uint8 _oldEModeID = _market.eModeID;

        require(_oldEModeID == 0, "_setEMode: Has set eMode id!");
        _validateEModeLTV(
            _market.collateralFactorMantissa,
            _eModeLiqThreshold,
            _eModeLtv
        );
        _validateLiquidationThreshold(_eModeLtv, _eModeLiqThreshold);

        _market.eModeID = _newEModeID;

        uint256 _oldEModeLtv = marketCollateralFactor[_iToken][2];
        marketCollateralFactor[_iToken][2] = _eModeLtv;
        uint256 _oldEModeLiqThreshold = marketCollateralFactor[_iToken][3];
        marketCollateralFactor[_iToken][3] = _eModeLiqThreshold;

        emit EModeChanged(_iToken, _oldEModeID, _newEModeID);
        emit NewEModeLTV(_iToken, _oldEModeLtv, _eModeLtv);
        emit NewEModeLiquidationThreshold(
            _iToken,
            _oldEModeLiqThreshold,
            _eModeLiqThreshold
        );
    }

    function _addEModeInternal(
        uint256 _liquidationIncentive,
        uint256 _closeFactor,
        string memory _label
    ) internal {
        uint8 _eModesLen = uint8(eModes.length);
        require(_eModesLen < MAX_EMODE_ID, "_addEMode: Max EMode reached!");

        // Check parameters in the eMode.
        _validateEModeLiquidationIncentive(_liquidationIncentive);
        _validateEModeCloseFactor(_closeFactor);

        eModes.push(
            EModeConfig({
                liquidationIncentive: _liquidationIncentive,
                closeFactor: _closeFactor,
                label: _label
            })
        );

        // Use the length of eModes as the new eMode id.
        emit EModeAdded(
            _eModesLen,
            _liquidationIncentive,
            _closeFactor,
            _label
        );
    }

    /**
     * @notice Has already checked the parameter `_newEModeId`.
     * @dev Update caller's eMode ID.
     */
    function _enterEMode(uint8 _newEModeId, address _account) internal {
        uint8 _oldEModeID = accountsEMode[_account];
        accountsEMode[_account] = _newEModeId;

        emit EModeEntered(_oldEModeID, _newEModeId, _account);
    }

    /*********************************/
    /****** General Information ******/
    /*********************************/

    /**
     * @param _account The address of the account to query
     * @return _len The length of the markets that account has entered
     */
    function getEnteredMarketsLength(
        address _account
    ) internal view returns (uint256 _len) {
        AccountData storage _accountData = accountsData[_account];

        _len = _accountData.collaterals.length();
    }

    function getIsolationModeState(
        address _account
    ) public view override returns (bool, address) {
        AccountData storage _accountData = accountsData[_account];

        if (_accountData.collaterals.length() > 0) {
            // Has collateral
            address firstCollateral = _accountData.collaterals.at(0);
            MarketV2 storage _market = markets[firstCollateral];

            if (_market.debtCeiling > 0) {
                return (true, firstCollateral);
            }
        }

        return (false, address(0));
    }

    function getLiquidationIncentive(
        address _iToken,
        address _account
    ) public view override returns (uint256 _liquidationIncentive) {
        uint8 effectedEMode = _getEffectedEMode(_iToken, _account);

        _liquidationIncentive = eModes[effectedEMode].liquidationIncentive;
    }
}
