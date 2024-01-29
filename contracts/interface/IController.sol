//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IControllerAdminV1 {
    /// @notice Emitted when an admin supports a market
    event MarketAdded(
        address iToken,
        uint256 collateralFactor,
        uint256 borrowFactor,
        uint256 supplyCapacity,
        uint256 borrowCapacity,
        uint256 distributionFactor
    );

    function _addMarket(
        address _iToken,
        uint256 _collateralFactor,
        uint256 _borrowFactor,
        uint256 _supplyCapacity,
        uint256 _borrowCapacity,
        uint256 _distributionFactor
    ) external;

    /// @notice Emitted when new price oracle is set
    event NewPriceOracle(address oldPriceOracle, address newPriceOracle);

    function _setPriceOracle(address newOracle) external;

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(
        uint256 oldCloseFactorMantissa,
        uint256 newCloseFactorMantissa
    );

    function _setCloseFactor(uint256 newCloseFactorMantissa) external;

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(
        uint256 oldLiquidationIncentiveMantissa,
        uint256 newLiquidationIncentiveMantissa
    );

    function _setLiquidationIncentive(
        uint256 newLiquidationIncentiveMantissa
    ) external;

    /// @notice Emitted when iToken's collateral factor is changed by admin
    event NewCollateralFactor(
        address iToken,
        uint256 oldCollateralFactorMantissa,
        uint256 newCollateralFactorMantissa
    );

    function _setCollateralFactor(
        address iToken,
        uint256 newCollateralFactorMantissa
    ) external;

    /// @notice Emitted when iToken's borrow factor is changed by admin
    event NewBorrowFactor(
        address iToken,
        uint256 oldBorrowFactorMantissa,
        uint256 newBorrowFactorMantissa
    );

    function _setBorrowFactor(
        address iToken,
        uint256 newBorrowFactorMantissa
    ) external;

    /// @notice Emitted when iToken's borrow capacity is changed by admin
    event NewBorrowCapacity(
        address iToken,
        uint256 oldBorrowCapacity,
        uint256 newBorrowCapacity
    );

    function _setBorrowCapacity(
        address iToken,
        uint256 newBorrowCapacity
    ) external;

    /// @notice Emitted when iToken's supply capacity is changed by admin
    event NewSupplyCapacity(
        address iToken,
        uint256 oldSupplyCapacity,
        uint256 newSupplyCapacity
    );

    function _setSupplyCapacity(
        address iToken,
        uint256 newSupplyCapacity
    ) external;

    /// @notice Emitted when pause guardian is changed by admin
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    function _setPauseGuardian(address newPauseGuardian) external;

    /// @notice Emitted when mint is paused/unpaused by admin or pause guardian
    event MintPaused(address iToken, bool paused);

    function _setMintPaused(address iToken, bool paused) external;

    function _setAllMintPaused(bool paused) external;

    /// @notice Emitted when redeem is paused/unpaused by admin or pause guardian
    event RedeemPaused(address iToken, bool paused);

    function _setRedeemPaused(address iToken, bool paused) external;

    function _setAllRedeemPaused(bool paused) external;

    /// @notice Emitted when borrow is paused/unpaused by admin or pause guardian
    event BorrowPaused(address iToken, bool paused);

    function _setBorrowPaused(address iToken, bool paused) external;

    function _setAllBorrowPaused(bool paused) external;

    /// @notice Emitted when transfer is paused/unpaused by admin or pause guardian
    event TransferPaused(bool paused);

    function _setTransferPaused(bool paused) external;

    /// @notice Emitted when seize is paused/unpaused by admin or pause guardian
    event SeizePaused(bool paused);

    function _setSeizePaused(bool paused) external;

    function _setiTokenPaused(address iToken, bool paused) external;

    function _setProtocolPaused(bool paused) external;

    event NewRewardDistributor(
        address oldRewardDistributor,
        address _newRewardDistributor
    );

    function _setRewardDistributor(address _newRewardDistributor) external;
}

interface IControllerPolicyV1 {
    function beforeMint(
        address iToken,
        address account,
        uint256 mintAmount
    ) external;

    function afterMint(
        address iToken,
        address minter,
        uint256 mintAmount,
        uint256 mintedAmount
    ) external;

    function beforeRedeem(
        address iToken,
        address redeemer,
        uint256 redeemAmount
    ) external;

    function afterRedeem(
        address iToken,
        address redeemer,
        uint256 redeemAmount,
        uint256 redeemedAmount
    ) external;

    function beforeBorrow(
        address iToken,
        address borrower,
        uint256 borrowAmount
    ) external;

    function afterBorrow(
        address iToken,
        address borrower,
        uint256 borrowedAmount
    ) external;

    function beforeRepayBorrow(
        address iToken,
        address payer,
        address borrower,
        uint256 repayAmount
    ) external;

    function afterRepayBorrow(
        address iToken,
        address payer,
        address borrower,
        uint256 repayAmount
    ) external;

    function beforeLiquidateBorrow(
        address iTokenBorrowed,
        address iTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repayAmount
    ) external;

    function afterLiquidateBorrow(
        address iTokenBorrowed,
        address iTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repaidAmount,
        uint256 seizedAmount
    ) external;

    function beforeSeize(
        address iTokenBorrowed,
        address iTokenCollateral,
        address liquidator,
        address borrower,
        uint256 seizeAmount
    ) external;

    function afterSeize(
        address iTokenBorrowed,
        address iTokenCollateral,
        address liquidator,
        address borrower,
        uint256 seizedAmount
    ) external;

    function beforeTransfer(
        address iToken,
        address from,
        address to,
        uint256 amount
    ) external;

    function afterTransfer(
        address iToken,
        address from,
        address to,
        uint256 amount
    ) external;

    function beforeFlashloan(
        address iToken,
        address to,
        uint256 amount
    ) external;

    function afterFlashloan(
        address iToken,
        address to,
        uint256 amount
    ) external;
}

interface IControllerAccountEquityV1 {
    function calcAccountEquity(
        address account
    ) external view returns (uint256, uint256, uint256, uint256);

    function liquidateCalculateSeizeTokens(
        address iTokenBorrowed,
        address iTokenCollateral,
        uint256 actualRepayAmount
    ) external view returns (uint256);
}

interface IControllerAccountV1 {
    function hasEnteredMarket(
        address account,
        address iToken
    ) external view returns (bool);

    function getEnteredMarkets(
        address account
    ) external view returns (address[] memory);

    /// @notice Emitted when an account enters a market
    event MarketEntered(address iToken, address account);

    function enterMarkets(
        address[] calldata iTokens
    ) external returns (bool[] memory);

    function enterMarketFromiToken(address _market, address _account) external;

    /// @notice Emitted when an account exits a market
    event MarketExited(address iToken, address account);

    function exitMarkets(
        address[] calldata iTokens
    ) external returns (bool[] memory);

    /// @notice Emitted when an account add a borrow asset
    event BorrowedAdded(address iToken, address account);

    /// @notice Emitted when an account remove a borrow asset
    event BorrowedRemoved(address iToken, address account);

    function hasBorrowed(
        address account,
        address iToken
    ) external view returns (bool);

    function getBorrowedAssets(
        address account
    ) external view returns (address[] memory);
}

interface IControllerV1 is
    IControllerAdminV1,
    IControllerPolicyV1,
    IControllerAccountEquityV1,
    IControllerAccountV1
{
    /**
     * @notice Security checks when updating the comptroller of a market, always expect to return true.
     */
    function isController() external view returns (bool);

    /**
     * @notice Return all of the iTokens
     * @return The list of iToken addresses
     */
    function getAlliTokens() external view returns (address[] memory);

    /**
     * @notice Check whether a iToken is listed in controller
     * @param _iToken The iToken to check for
     * @return true if the iToken is listed otherwise false
     */
    function hasiToken(address _iToken) external view returns (bool);
}

interface IControllerV2 {
    event NewExtraExplicit(
        address _oldExtraExplicit,
        address _newExtraExplicit
    );

    function _setExtraExplicit(address _newExtraExplicit) external;

    event NewExtraImplicit(
        address _oldExtraImplicit,
        address _newExtraImplicit
    );

    function _setExtraImplicit(address _newExtraImplicit) external;

    function _upgrade(
        address _newExtraImplicit,
        address _newExtraExplicit
    ) external;

    /**
     * @param _iToken The _iToken to add
     * @param _collateralFactor The _collateralFactor of _iToken
     * @param _borrowFactor The _borrowFactor of _iToken
     * @param _supplyCapacity The _supplyCapacity of _iToken
     * @param _borrowCapacity The _borrowCapacity of _iToken
     * @param _distributionFactor The _distributionFactor of _iToken
     * @param _iTokenEModeID The eEMode ID of _iToken
     * @param _eModeLtv The collateral factor of _iToken in the eMode
     * @param _eModeLiqThreshold The liquidation Threshold of _iToken in the  eMode
     * @param _liquidationThreshold The liquidation Threshold of _iToken
     * @param _debtCeiling The _debtCeiling of _iToken in isolation mode, notice its decimal `DEBT_CEILING_DECIMALS`
     * @param _borrowableInIsolation True if the _iToken is borrowable in isolation mode
     */
    struct AddMarketV2LocalVars {
        address _iToken;
        uint256 _collateralFactor;
        uint256 _borrowFactor;
        uint256 _supplyCapacity;
        uint256 _borrowCapacity;
        uint256 _distributionFactor;
        uint8 _eModeID;
        uint256 _eModeLtv;
        uint256 _eModeLiqThreshold;
        uint256 _liquidationThreshold;
        uint256 _debtCeiling;
        bool _borrowableInIsolation;
    }

    function _addMarketV2(AddMarketV2LocalVars memory _vars) external;

    function exitMarketFromiToken(address _market, address _account) external;
}

interface IControllerV2ExtraBase {
    event DebtCeilingChanged(
        address iToken,
        uint256 oldDebtCeiling,
        uint256 newDebtCeiling
    );

    event BorrowableInIsolationChanged(address iToken, bool borrowable);

    event NewTimeLock(address oldTimeLock, address newTimeLock);

    event NewTimeLockStrategy(
        address oldTimeLockStrategy,
        address newTimeLockStrategy
    );

    event EModeAdded(
        uint8 eModeId,
        uint256 liquidationIncentive,
        uint256 closeFactor,
        string label
    );

    event EModeChanged(
        address iToken,
        uint8 oldCategoryId,
        uint8 newCategoryId
    );

    event NewLiquidationThreshold(
        address _iToken,
        uint256 _oldLiquidationThresholdMantissa,
        uint256 _newLiquidationThresholdMantissa
    );

    event NewEModeLiquidationIncentive(
        uint8 _eModeID,
        uint256 _oldEModeLiquidationIncentive,
        uint256 _newEModeLiquidationIncentive
    );

    event NewEModeCloseFactor(
        uint8 _eModeID,
        uint256 _oldEModeCloseFactor,
        uint256 _newEModeCloseFactor
    );

    event NewEModeLTV(
        address _iToken,
        uint256 _oldEModeLTV,
        uint256 _newEModeLTV
    );

    event NewEModeLiquidationThreshold(
        address _iToken,
        uint256 _oldEModeLiquidationThreshold,
        uint256 _newEModeLiquidationThreshold
    );

    event EModeEntered(uint8 oldEModeId, uint8 newEModeId, address account);

    function getIsolationModeState(
        address _account
    ) external view returns (bool, address);

    function getLiquidationIncentive(
        address _iToken,
        address _account
    ) external view returns (uint256);
}

interface IControllerV2ExtraExplicit is IControllerV2ExtraBase {
    function isControllerExtraExplicit() external view returns (bool);

    function initialize() external;

    function _upgrade() external;

    function _addMarketV2(
        IControllerV2.AddMarketV2LocalVars memory _vars
    ) external;

    function _setCollateralFactor(
        address iToken,
        uint256 newCollateralFactorMantissa
    ) external;

    function _setCloseFactor(uint256 newCloseFactorMantissa) external;

    function _setLiquidationIncentive(
        uint256 newLiquidationIncentiveMantissa
    ) external;

    function beforeBorrow(
        address iToken,
        address borrower,
        uint256 borrowAmount
    ) external;

    function afterRepayBorrow(
        address iToken,
        address payer,
        address borrower,
        uint256 repayAmount
    ) external;

    function beforeEnterMarket(address _iToken, address _account) external view;

    function getCloseFactor(
        address _iToken,
        address _account
    ) external view returns (uint256);
}

interface IControllerV2ExtraImplicit is IControllerV2ExtraBase {
    function isControllerExtraImplicit() external view returns (bool);

    function _setDebtCeiling(address _iToken, uint256 _newDebtCeiling) external;

    function _setBorrowableInIsolation(
        address _iToken,
        bool _borrowable
    ) external;

    function _setTimeLock(address _newTimeLock) external;

    function _setTimeLockStrategy(address _newTimeLockStrategy) external;

    function _addEMode(
        uint256 _liquidationIncentive,
        uint256 _closeFactor,
        string memory _label
    ) external;

    function _setEMode(
        address _iToken,
        uint8 _eModeID,
        uint256 _eModeLtv,
        uint256 _eModeLiqThreshold
    ) external;

    function _setLiquidationThreshold(
        address _iToken,
        uint256 _newLiquidationThresholdMantissa
    ) external;

    function _setEModeLiquidationIncentive(
        uint8 _eModeID,
        uint256 _liquidationIncentive
    ) external;

    function _setEModeCloseFactor(
        uint8 _eModeID,
        uint256 _closeFactor
    ) external;

    function _setEModeLTV(address _iToken, uint256 _ltv) external;

    function _setEModeLiquidationThreshold(
        address _iToken,
        uint256 _liquidationThreshold
    ) external;

    function beforeTransferUnderlying(
        address _asset,
        address _underlying,
        uint256 _amount,
        address _recipient
    ) external returns (address _dst);

    function liquidateCalculateSeizeTokensV2(
        address iTokenBorrowed,
        address iTokenCollateral,
        uint256 actualRepayAmount,
        address borrower
    ) external view returns (uint256);

    function calcAccountEquityWithEffectV2(
        address _account,
        address _tokenToEffect,
        uint256 _redeemAmount,
        uint256 _borrowAmount,
        bool _isLiquidation
    ) external view returns (uint256, uint256, uint256, uint256);

    function enterEMode(uint8 _newEModeId) external;

    function getEModeLength() external view returns (uint256 _eModeLength);

    function getCollateralFactor(
        address _iToken,
        uint8 _accountEModeID,
        uint8 _iTokenEModeID,
        bool _isLiquidation
    ) external view returns (uint256 _collateralFactor);

    function getLTV(address _iToken) external view returns (uint256);

    function getLiquidationThreshold(
        address _iToken
    ) external view returns (uint256);

    function getEModeLTV(address _iToken) external view returns (uint256);

    function getEModeLiquidationThreshold(
        address _iToken
    ) external view returns (uint256);
}

/**
 * @dev External Interfaces for test cases and front end
 */
interface IController is
    IControllerV1,
    IControllerV2,
    IControllerV2ExtraImplicit
{
    struct MarketV2 {
        /*
         *  Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be in [0, 0.9], and stored as a mantissa.
         */
        uint256 collateralFactorMantissa;
        /*
         *  Multiplier representing the most one can borrow the asset.
         *  For instance, 0.5 to allow borrowing this asset 50% * collateral value * collateralFactor.
         *  When calculating equity, 0.5 with 100 borrow balance will produce 200 borrow value
         *  Must be between (0, 1], and stored as a mantissa.
         */
        uint256 borrowFactorMantissa;
        /*
         *  The borrow capacity of the asset, will be checked in beforeBorrow()
         *  -1 means there is no limit on the capacity
         *  0 means the asset can not be borrowed any more
         */
        uint256 borrowCapacity;
        /*
         *  The supply capacity of the asset, will be checked in beforeMint()
         *  -1 means there is no limit on the capacity
         *  0 means the asset can not be supplied any more
         */
        uint256 supplyCapacity;
        // Whether market's mint is paused
        bool mintPaused;
        // Whether market's redeem is paused
        bool redeemPaused;
        // Whether market's borrow is paused
        bool borrowPaused;
        // eMode config
        // TODO: explanation
        uint8 eModeID;
        //  Whether market can be borrowed in isolation mode
        bool borrowableInIsolation;
        // Debt ceiling for the market
        uint256 debtCeiling;
        // Current debt in isolation mode
        uint256 currentDebt;
    }

    function extraImplicit() external view returns (address);

    function extraExplicit() external view returns (address);

    function timeLock() external view returns (address);

    function timeLockStrategy() external view returns (address);

    function marketsV2(address _iToken) external view returns (MarketV2 memory);

    function DEBT_CEILING_DECIMALS() external view returns (uint256);

    function accountsEMode(
        address account
    ) external view returns (uint8 eModeID);

    function eModes(
        uint256 index
    )
        external
        view
        returns (
            uint256 liquidationIncentive,
            uint256 closeFactor,
            string calldata label
        );

    function liquidationIncentiveMantissa() external view returns (uint256);

    function closeFactorMantissa() external view returns (uint256);

    function initializeV2(
        address _newExtraImplicit,
        address _newExtraExplicit
    ) external;

    function initialize() external;
}
