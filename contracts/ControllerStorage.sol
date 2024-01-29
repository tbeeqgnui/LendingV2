//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";

contract ControllerStorageV1 {
    /// @dev EnumerableSet of all iTokens
    EnumerableSetUpgradeable.AddressSet internal iTokens;

    struct Market {
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
    }

    /// @notice Mapping of iTokens to corresponding markets
    mapping(address => Market) public markets;

    struct AccountData {
        // Account's collateral assets
        EnumerableSetUpgradeable.AddressSet collaterals;
        // Account's borrowed assets
        EnumerableSetUpgradeable.AddressSet borrowed;
    }

    /// @dev Mapping of accounts' data, including collateral and borrowed assets
    mapping(address => AccountData) internal accountsData;

    /**
     * @notice Oracle to query the price of a given asset
     */
    address public priceOracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint256 public closeFactorMantissa;

    // closeFactorMantissa must be strictly greater than this value
    uint256 internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint256 internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint256 public liquidationIncentiveMantissa;

    // liquidationIncentiveMantissa must be no less than this value
    uint256 internal constant liquidationIncentiveMinMantissa = 1.0e18; // 1.0

    // liquidationIncentiveMantissa must be no greater than this value
    uint256 internal constant liquidationIncentiveMaxMantissa = 1.5e18; // 1.5

    // collateralFactorMantissa must not exceed this value
    uint256 internal constant collateralFactorMaxMantissa = 1e18; // 1.0

    // borrowFactorMantissa must not exceed this value
    uint256 internal constant borrowFactorMaxMantissa = 1e18; // 1.0

    /**
     * @notice Guardian who can pause mint/borrow/liquidate/transfer in case of emergency
     */
    address public pauseGuardian;

    /// @notice whether global transfer is paused
    bool public transferPaused;

    /// @notice whether global seize is paused
    bool public seizePaused;

    /**
     * @notice the address of reward distributor
     */
    address public rewardDistributor;
}

contract ControllerStorageV2 is ControllerStorageV1 {
    /**
     * @notice the address of extra implicit implementation for v2
     */
    address public extraImplicit;
    /**
     * @notice the address of extra explicit implementation for v2
     */
    address public extraExplicit;
}

/*
 *  ControllerStorageV2Extra should inherit from ControllerStorageV2
 *  But it expands the `MarketV1` to `MarketV2` by expanding serveral market configuration
 *  Therefore, just copying all the storage from it.
 *  Only ControllerExtraXXX have access to the new storages regarding V2 features such as eModes etc..
 */

contract ControllerStorageV2Extra {
    /// @dev EnumerableSet of all iTokens
    EnumerableSetUpgradeable.AddressSet internal iTokens;

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
        // EMode Id
        uint8 eModeID;
        // Isolation config
        // Whether market can be borrowed in isolation mode
        bool borrowableInIsolation;
        // Debt ceiling for the market
        uint256 debtCeiling;
        // Current debt in isolation mode
        uint256 currentDebt;
    }

    /// @notice Mapping of iTokens to corresponding markets
    mapping(address => MarketV2) public markets;

    struct AccountData {
        // Account's collateral assets
        EnumerableSetUpgradeable.AddressSet collaterals;
        // Account's borrowed assets
        EnumerableSetUpgradeable.AddressSet borrowed;
    }

    /// @dev Mapping of accounts' data, including collateral and borrowed assets
    mapping(address => AccountData) internal accountsData;

    /**
     * @notice Oracle to query the price of a given asset
     */
    address public priceOracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint256 public closeFactorMantissa;

    // closeFactorMantissa must be strictly greater than this value
    uint256 internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint256 internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint256 public liquidationIncentiveMantissa;

    // liquidationIncentiveMantissa must be no less than this value
    uint256 internal constant liquidationIncentiveMinMantissa = 1.0e18; // 1.0

    // liquidationIncentiveMantissa must be no greater than this value
    uint256 internal constant liquidationIncentiveMaxMantissa = 1.5e18; // 1.5

    // collateralFactorMantissa must not exceed this value
    uint256 internal constant collateralFactorMaxMantissa = 1e18; // 1.0

    // borrowFactorMantissa must not exceed this value
    uint256 internal constant borrowFactorMaxMantissa = 1e18; // 1.0

    /**
     * @notice Guardian who can pause mint/borrow/liquidate/transfer in case of emergency
     */
    address public pauseGuardian;

    /// @notice whether global transfer is paused
    bool public transferPaused;

    /// @notice whether global seize is paused
    bool public seizePaused;

    /**
     * @notice the address of reward distributor
     */
    address public rewardDistributor;

    /**
     * End of ControllerStorageV1
     */

    /**
     * @notice the address of extra implicit implementation for v2
     */
    address public extraImplicit;
    /**
     * @notice the address of extra explicit implementation for v2
     */
    address public extraExplicit;

    // Borrow/Withdraw delay
    address public timeLockStrategy;
    address public timeLock; // borrow/withdraw delay contract

    /// @notice decimals for debt ceiling
    uint256 public constant DEBT_CEILING_DECIMALS = 2;

    // eMode configs
    uint256 constant MAX_EMODE_ID = 255;

    struct EModeConfig {
        uint256 liquidationIncentive; // 1.01e18
        uint256 closeFactor; // 0.5e18
        string label; // Stablecoins
    }

    EModeConfig[] public eModes;

    // [0] -> Normal LTV
    // [1] -> Normal Liquidation Threshold
    // [2] -> eMode LTV
    // [3] -> eMode Liquidation Threshold
    mapping(address => uint256[4]) public marketCollateralFactor;

    // account => eMode id
    mapping(address => uint8) public accountsEMode;
}
