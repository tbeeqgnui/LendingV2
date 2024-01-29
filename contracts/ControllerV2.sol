//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";

import "@openzeppelin/contracts/utils/Address.sol";

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

import "./Controller.sol";

/**
 * @title dForce's lending controller Contract
 * @author dForce
 */
contract ControllerV2 is Controller, ControllerStorageV2, IControllerV2 {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeRatioMath for uint256;
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using Address for address;

    constructor(address _newExtraImplicit, address _newExtraExplicit) public {
        initializeV2(_newExtraImplicit, _newExtraExplicit);
    }

    /**
     * @notice Initializes the contract.
     */
    function initializeV2(
        address _newExtraImplicit,
        address _newExtraExplicit
    ) public initializer {
        super.initialize();

        _setExtraImplicitInternal(_newExtraImplicit);
        _setExtraExplicitInternal(_newExtraExplicit);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit.initialize.selector
            )
        );
    }

    /**
     * @notice Sets the extra explicit implementation addresses
     * @dev Admin function to set extra explicit address
     * @param _newExtraExplicit New extra explicit address
     */
    function _setExtraExplicit(
        address _newExtraExplicit
    ) external override onlyOwner {
        // `_upgrade` would fail if _newExtraExplicit has been set
        require(
            extraExplicit != address(0),
            "_setExtraExplicit: Should upgrade first!"
        );

        _setExtraExplicitInternal(_newExtraExplicit);
    }

    function _setExtraExplicitInternal(address _newExtraExplicit) internal {
        address _oldExtraExplicit = extraExplicit;

        require(
            _newExtraExplicit != address(0) &&
                _newExtraExplicit != _oldExtraExplicit,
            "_newExtraExplicit address invalid!"
        );

        require(
            IControllerV2ExtraExplicit(_newExtraExplicit)
                .isControllerExtraExplicit(),
            "_newExtraExplicit is not a extra explicit implementation!"
        );

        extraExplicit = _newExtraExplicit;
        emit NewExtraExplicit(_oldExtraExplicit, _newExtraExplicit);
    }

    /**
     * @notice Sets the extra implicit implementation addresses
     * @dev Admin function to set extra implicit address
     * @param _newExtraImplicit New extra implicit address
     */
    function _setExtraImplicit(
        address _newExtraImplicit
    ) external override onlyOwner {
        // `_upgrade` would fail if _newExtraImplicit has been set
        require(
            extraImplicit != address(0),
            "_setExtraImplicit: Should upgrade first!"
        );

        _setExtraImplicitInternal(_newExtraImplicit);
    }

    function _setExtraImplicitInternal(address _newExtraImplicit) internal {
        address _oldExtraImplicit = extraImplicit;

        require(
            _newExtraImplicit != address(0) &&
                _newExtraImplicit != _oldExtraImplicit,
            "_newExtraImplicit address invalid!"
        );

        require(
            IControllerV2ExtraImplicit(_newExtraImplicit)
                .isControllerExtraImplicit(),
            "_newExtraImplicit is not a extra implicit implementation!"
        );

        extraImplicit = _newExtraImplicit;
        emit NewExtraImplicit(_oldExtraImplicit, _newExtraImplicit);
    }

    /**
     * @dev Copied from openzeppelin-contracts/blob/master/contracts/proxy/Proxy.sol
     *
     * To fallback to the extra logic functions that can not fit in this contract
     * due to contract size limit.
     */
    function _delegate(address _target) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), _target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    fallback() external payable {
        require(extraImplicit != address(0), "No Extra Implicit address!");
        _delegate(extraImplicit);
    }

    /**
     * @notice upgrade the controller to V2.
     */
    function _upgrade(
        address _newExtraImplicit,
        address _newExtraExplicit
    ) external override onlyOwner {
        require(
            extraImplicit == address(0) && extraExplicit == address(0),
            "_upgrade: Has been upgraded!"
        );

        _setExtraImplicitInternal(_newExtraImplicit);
        _setExtraExplicitInternal(_newExtraExplicit);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(IControllerV2ExtraExplicit._upgrade.selector)
        );
    }

    /*********************************/
    /******** Admin Operations *******/
    /*********************************/

    /**
     * @notice Admin function to add iToken into supported markets
     * It is deprecated in V2, as liquidation threshold is also mandatory
     */
    function _addMarket(
        address /* _iToken */,
        uint256 /* _collateralFactor */,
        uint256 /* _borrowFactor */,
        uint256 /* _supplyCapacity */,
        uint256 /* _borrowCapacity */,
        uint256 /* _distributionFactor */
    ) public override onlyOwner {
        revert("_addMarket() is deprecated, use _addMarketV2()!");
    }

    /**
     * @notice Admin function to add iToken into supported markets
     * Checks if the iToken already exists
     * Will `revert()` if any check fails
     */
    function _addMarketV2(
        IControllerV2.AddMarketV2LocalVars memory _vars
    ) external override onlyOwner {
        super._addMarket(
            _vars._iToken,
            _vars._collateralFactor,
            _vars._borrowFactor,
            _vars._supplyCapacity,
            _vars._borrowCapacity,
            _vars._distributionFactor
        );

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit._addMarketV2.selector,
                _vars
            )
        );
    }

    function _setCollateralFactor(
        address _iToken,
        uint256 _newCollateralFactorMantissa
    ) public override onlyOwner {
        super._setCollateralFactor(_iToken, _newCollateralFactorMantissa);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit._setCollateralFactor.selector,
                _iToken,
                _newCollateralFactorMantissa
            )
        );
    }

    function _setCloseFactor(
        uint256 _newCloseFactorMantissa
    ) public override onlyOwner {
        super._setCloseFactor(_newCloseFactorMantissa);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit._setCloseFactor.selector,
                _newCloseFactorMantissa
            )
        );
    }

    function _setLiquidationIncentive(
        uint256 _newLiquidationIncentiveMantissa
    ) public override onlyOwner {
        super._setLiquidationIncentive(_newLiquidationIncentiveMantissa);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit._setLiquidationIncentive.selector,
                _newLiquidationIncentiveMantissa
            )
        );
    }

    /*********************************/
    /******** Policy Hooks **********/
    /*********************************/
    /**
     * @notice Hook function before iToken `borrow()`
     * Checks if the account should be allowed to borrow the given iToken
     * Will `revert()` if any check fails
     * @param _iToken The iToken to check the borrow against
     * @param _borrower The account which would borrow iToken
     * @param _borrowAmount The amount of underlying to borrow
     */
    function beforeBorrow(
        address _iToken,
        address _borrower,
        uint256 _borrowAmount
    ) public virtual override {
        super.beforeBorrow(_iToken, _borrower, _borrowAmount);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit.beforeBorrow.selector,
                _iToken,
                _borrower,
                _borrowAmount
            )
        );
    }

    /**
     * @notice Hook function after iToken `repayBorrow()`
     * Will `revert()` if any operation fails
     * @param _iToken The iToken being repaid
     * @param _payer The account which would repay
     * @param _borrower The account which has borrowed
     * @param _repayAmount  The amount of underlying being repaid
     */
    function afterRepayBorrow(
        address _iToken,
        address _payer,
        address _borrower,
        uint256 _repayAmount
    ) public virtual override {
        super.afterRepayBorrow(_iToken, _payer, _borrower, _repayAmount);

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit.afterRepayBorrow.selector,
                _iToken,
                _payer,
                _borrower,
                _repayAmount
            )
        );
    }

    /**
     * @notice Hook function before iToken `liquidateBorrow()`
     * Checks if the account should be allowed to liquidate the given iToken
     * for the borrower. Will `revert()` if any check fails
     * @param _iTokenBorrowed The iToken was borrowed
     * @param _iTokenCollateral The collateral iToken to be liquidate with
     * @param _liquidator The account which would repay the borrowed iToken
     * @param _borrower The account which has borrowed
     * @param _repayAmount The amount of underlying to repay
     */
    function beforeLiquidateBorrow(
        address _iTokenBorrowed,
        address _iTokenCollateral,
        address _liquidator,
        address _borrower,
        uint256 _repayAmount
    ) external override {
        // Tokens must have been listed
        require(
            iTokens.contains(_iTokenBorrowed) &&
                iTokens.contains(_iTokenCollateral),
            "Tokens have not been listed"
        );

        (, uint256 _shortfall, , ) = _calcAccountEquityWithEffect(
            _borrower, // _account
            address(0), // _tokenToEffect,
            0, // _redeemAmount,
            0, // _borrowAmount,
            true // _isLiquidation
        );

        require(_shortfall > 0, "Account does not have shortfall");

        // Only allowed to repay the borrow balance's close factor
        uint256 _borrowBalance = IiToken(_iTokenBorrowed).borrowBalanceStored(
            _borrower
        );

        uint256 _closeFactorMantissa = abi.decode(
            extraExplicit.functionDelegateCall(
                abi.encodeWithSelector(
                    IControllerV2ExtraExplicit.getCloseFactor.selector,
                    _iTokenCollateral,
                    _borrower
                )
            ),
            (uint256)
        );

        uint256 _maxRepay = _borrowBalance.rmul(_closeFactorMantissa);

        require(_repayAmount <= _maxRepay, "Repay exceeds max repay allowed");

        _liquidator;
    }

    /*********************************/
    /** Account equity calculation ***/
    /*********************************/
    /**
     * @notice Calculates current account equity plus some token and amount to effect
     */
    function _calcAccountEquityWithEffect(
        address _account,
        address _tokenToEffect,
        uint256 _redeemAmount,
        uint256 _borrowAmount,
        bool _isLiquidation
    ) internal view virtual returns (uint256, uint256, uint256, uint256) {
        // Use delegatecall would mark this function non-view
        // Now the call the view function on address(this) will trigger the fallback
        // Therefore delegatecall the extraImplicit implementation
        // Luckily, for account equity no context needs to be reserved
        return
            IControllerV2ExtraImplicit(address(this))
                .calcAccountEquityWithEffectV2(
                    _account,
                    _tokenToEffect,
                    _redeemAmount,
                    _borrowAmount,
                    _isLiquidation
                );
    }

    /**
     * @notice Calculates current account equity plus some token and amount to effect
     * @param _account The account to query equity of
     * @param _tokenToEffect The token address to add some additional redeem/borrow
     * @param _redeemAmount The additional amount to redeem
     * @param _borrowAmount The additional amount to borrow
     * @return account equity, shortfall, collateral value, borrowed value plus the effect.
     */
    function calcAccountEquityWithEffect(
        address _account,
        address _tokenToEffect,
        uint256 _redeemAmount,
        uint256 _borrowAmount
    )
        internal
        view
        virtual
        override
        returns (uint256, uint256, uint256, uint256)
    {
        return
            _calcAccountEquityWithEffect(
                _account,
                _tokenToEffect,
                _redeemAmount,
                _borrowAmount,
                false
            );
    }

    /*********************************/
    /*** Account Markets Operation ***/
    /*********************************/

    function _enterMarket(
        address _iToken,
        address _account
    ) internal virtual override returns (bool) {
        // market not listed, skip it
        if (!iTokens.contains(_iToken)) {
            return false;
        }

        extraExplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraExplicit.beforeEnterMarket.selector,
                _iToken,
                _account
            )
        );

        // add() will return false if iToken is in account's MarketV2 list
        if (accountsData[_account].collaterals.add(_iToken)) {
            emit MarketEntered(_iToken, _account);
        }

        return true;
    }

    /**
     * @notice Only expect to be called by iToken contract.
     * @dev Remove the market from the account's markets list and decrease equity.
     * @param _market The market to exit
     * @param _account The address of the account to modify
     */
    function exitMarketFromiToken(
        address _market,
        address _account
    ) external override {
        // msg.sender must be listed iToken
        _checkiTokenListed(msg.sender);

        require(
            _exitMarket(_market, _account),
            "exitMarketFromiToken: Only can exit a listed market!"
        );
    }
}
