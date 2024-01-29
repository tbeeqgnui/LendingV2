pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../../contracts/ControllerV2.sol";
import "../../../contracts/interface/IController.sol";

contract ControllerV2Harness is ControllerV2 {
    function Harness_iTokensLength() external returns (uint256) {
        return iTokens.length();
    }

    function Harness_collateralsLength(address account)
        external
        returns (uint256)
    {
        return accountsData[account].collaterals.length();
    }

    function Harness_borrowedLength(address account)
        external
        returns (uint256)
    {
        return accountsData[account].borrowed.length();
    }

    function Harness_indexOfiTokens(address iToken) external returns (uint256) {
        return iTokens._inner._indexes[bytes32(uint256(uint160(iToken)))];
    }

    function Harness_indexOfCollaterals(address iToken, address account)
        external
        returns (uint256)
    {
        return
            accountsData[account].collaterals._inner._indexes[
                bytes32(uint256(uint160(iToken)))
            ];
    }

    function Harness_indexOfBorrowed(address iToken, address account)
        external
        returns (uint256)
    {
        return
            accountsData[account].borrowed._inner._indexes[
                bytes32(uint256(uint160(iToken)))
            ];
    }

    function Harness_atiTokens(uint256 index) external returns (address) {
        return iTokens.at(index);
    }

    function Harness_atCollaterals(uint256 index, address account)
        external
        returns (address)
    {
        return accountsData[account].collaterals.at(index);
    }

    function Harness_atBorrowed(uint256 index, address account)
        external
        returns (address)
    {
        return accountsData[account].borrowed.at(index);
    }

    function Harness_iTokenController(address iToken) public returns (address) {
        return IiToken(iToken).controller();
    }

    function Harness_initalizedRewardDistributor() public returns (bool) {
        uint256 rdCodesize;
        address rd = rewardDistributor;
        assembly {
            rdCodesize := extcodesize(rd)
        }

        return rewardDistributor != address(0) && rdCodesize > 0;
    }

    function Harness_isiTokenIsolated(address iToken) public returns (bool) {
        return marketsV2(iToken).debtCeiling > 0;
    }

    function Harness_isInIsolationMode(address account)
        public
        returns (bool isInIsolationMode)
    {
        (isInIsolationMode, ) = getIsolationModeState(account);
    }

    function Harness_getIsolatedCollateral(address account)
        public
        returns (address isolatedCollateral)
    {
        (, isolatedCollateral) = getIsolationModeState(account);
    }

    function init_state() public {}

    function getIsolationModeState(address account)
        public
        returns (bool, address)
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraBase.getIsolationModeState.selector,
                        account
                    )
                ),
                (bool, address)
            );
    }

    function getLiquidationIncentive(address _iToken, address _account)
        external
        returns (uint256)
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraBase.getLiquidationIncentive.selector,
                        _iToken,
                        _account
                    )
                ),
                (uint256)
            );
    }

    function isControllerExtraImplicit() external returns (bool) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .isControllerExtraImplicit
                            .selector
                    )
                ),
                (bool)
            );
    }

    function _setDebtCeiling(address _iToken, uint256 _newDebtCeiling)
        external
    {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setDebtCeiling.selector,
                _iToken,
                _newDebtCeiling
            )
        );
    }

    function _setBorrowableInIsolation(address _iToken, bool _borrowable)
        external
    {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setBorrowableInIsolation.selector,
                _iToken,
                _borrowable
            )
        );
    }

    function _setTimeLock(address _newTimeLock) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setTimeLock.selector,
                _newTimeLock
            )
        );
    }

    function _setTimeLockStrategy(address _newTimeLockStrategy) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setTimeLockStrategy.selector,
                _newTimeLockStrategy
            )
        );
    }

    function _addEMode(
        uint256 _liquidationIncentive,
        uint256 _closeFactor,
        string memory _label
    ) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._addEMode.selector,
                _liquidationIncentive,
                _closeFactor,
                _label
            )
        );
    }

    function _setEMode(
        address _iToken,
        uint8 _eModeID,
        uint256 _eModeLtv,
        uint256 _eModeLiqThreshold
    ) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setEMode.selector,
                _iToken,
                _eModeID,
                _eModeLtv,
                _eModeLiqThreshold
            )
        );
    }

    function _setLiquidationThreshold(
        address _iToken,
        uint256 _newLiquidationThresholdMantissa
    ) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setLiquidationThreshold.selector,
                _iToken,
                _newLiquidationThresholdMantissa
            )
        );
    }

    function _setEModeLiquidationIncentive(
        uint8 _eModeID,
        uint256 _liquidationIncentive
    ) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit
                    ._setEModeLiquidationIncentive
                    .selector,
                _eModeID,
                _liquidationIncentive
            )
        );
    }

    function _setEModeCloseFactor(uint8 _eModeID, uint256 _closeFactor)
        external
    {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setEModeCloseFactor.selector,
                _eModeID,
                _closeFactor
            )
        );
    }

    function _setEModeLTV(address _iToken, uint256 _ltv) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit._setEModeLTV.selector,
                _iToken,
                _ltv
            )
        );
    }

    function _setEModeLiquidationThreshold(
        address _iToken,
        uint256 _liquidationThreshold
    ) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit
                    ._setEModeLiquidationThreshold
                    .selector,
                _iToken,
                _liquidationThreshold
            )
        );
    }

    function beforeTransferUnderlying(
        address _asset,
        address _underlying,
        uint256 _amount,
        address _recipient
    ) external returns (address _dst) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .beforeTransferUnderlying
                            .selector,
                        _asset,
                        _underlying,
                        _amount,
                        _recipient
                    )
                ),
                (address)
            );
    }

    function liquidateCalculateSeizeTokensV2(
        address iTokenBorrowed,
        address iTokenCollateral,
        uint256 actualRepayAmount,
        address borrower
    ) external returns (uint256) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .liquidateCalculateSeizeTokensV2
                            .selector,
                        iTokenBorrowed,
                        iTokenCollateral,
                        actualRepayAmount,
                        borrower
                    )
                ),
                (uint256)
            );
    }

    function calcAccountEquityWithEffectV2(
        address _account,
        address _tokenToEffect,
        uint256 _redeemAmount,
        uint256 _borrowAmount,
        bool _isLiquidation
    )
        external
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .calcAccountEquityWithEffectV2
                            .selector,
                        _account,
                        _tokenToEffect,
                        _redeemAmount,
                        _borrowAmount,
                        _isLiquidation
                    )
                ),
                (uint256, uint256, uint256, uint256)
            );
    }

    function enterEMode(uint8 _newEModeId) external {
        extraImplicit.functionDelegateCall(
            abi.encodeWithSelector(
                IControllerV2ExtraImplicit.enterEMode.selector,
                _newEModeId
            )
        );
    }

    function getEModeLength() external returns (uint256 _eModeLength) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit.getEModeLength.selector
                    )
                ),
                (uint256)
            );
    }

    function getCollateralFactor(
        address _iToken,
        uint8 _accountEModeID,
        uint8 _iTokenEModeID,
        bool _isLiquidation
    ) external returns (uint256 _collateralFactor) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit.getCollateralFactor.selector,
                        _iToken,
                        _accountEModeID,
                        _iTokenEModeID,
                        _isLiquidation
                    )
                ),
                (uint256)
            );
    }

    function getLTV(address _iToken) external returns (uint256) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit.getLTV.selector,
                        _iToken
                    )
                ),
                (uint256)
            );
    }

    function getLiquidationThreshold(address _iToken)
        external
        returns (uint256)
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .getLiquidationThreshold
                            .selector,
                        _iToken
                    )
                ),
                (uint256)
            );
    }

    function getEModeLTV(address _iToken) external returns (uint256) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit.getEModeLTV.selector,
                        _iToken
                    )
                ),
                (uint256)
            );
    }

    function getEModeLiquidationThreshold(address _iToken)
        external
        returns (uint256)
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IControllerV2ExtraImplicit
                            .getEModeLiquidationThreshold
                            .selector,
                        _iToken
                    )
                ),
                (uint256)
            );
    }

    function marketsV2(address iToken)
        public
        returns (ControllerStorageV2.MarketV2 memory)
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IController.marketsV2.selector,
                        iToken
                    )
                ),
                (ControllerStorageV2.MarketV2)
            );
    }

    function DEBT_CEILING_DECIMALS() external returns (uint256) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IController.DEBT_CEILING_DECIMALS.selector
                    )
                ),
                (uint256)
            );
    }

    function accountsEMode(address _user) external returns (uint8 eModeID) {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(
                        IController.accountsEMode.selector,
                        _user
                    )
                ),
                (uint8)
            );
    }

    function eModes(uint256 index)
        external
        returns (
            uint256 liquidationIncentive,
            uint256 closeFactor,
            string memory label
        )
    {
        return
            abi.decode(
                extraImplicit.functionDelegateCall(
                    abi.encodeWithSelector(IController.eModes.selector, index)
                ),
                (uint256, uint256, string)
            );
    }
}
