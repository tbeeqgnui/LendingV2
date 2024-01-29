//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "./library/Ownable.sol";
import "./library/Initializable.sol";
import "./interface/IiToken.sol";

interface IController {
    function isController() external view returns (bool);

    function hasiToken(address _iToken) external view returns (bool);
}

contract TimeLockStrategy is Initializable, Ownable {
    using SafeMathUpgradeable for uint256;

    uint256 internal constant DAY = 60 * 60 * 24;

    struct AssetLimitConfig {
        uint256 minSingleLimit;
        uint256 midSingleLimit;
        uint256 minDailyLimit;
        uint256 midDailyLimit;
    }

    struct AssetData {
        uint256 currentDailyAmount;
        uint256 dailyStartTime;
    }

    address public controller;

    // asset => asset limit config
    mapping(address => AssetLimitConfig) public assetLimitConfig;
    // asset => account => limit config
    mapping(address => mapping(address => AssetLimitConfig))
        public whitelistExtra;

    // asset => asset data
    mapping(address => AssetData) public assetData;

    // Single
    uint256 public minSingleWaitSeconds;
    uint256 public midSingleWaitSeconds;
    uint256 public maxSingleWaitSeconds;

    uint256 public minDailyWaitSeconds;
    uint256 public midDailyWaitSeconds;
    uint256 public maxDailyWaitSeconds;

    constructor(
        address _controller,
        uint256 _minSingleWaitSeconds,
        uint256 _midSingleWaitSeconds,
        uint256 _maxSingleWaitSeconds,
        uint256 _minDailyWaitSeconds,
        uint256 _midDailyWaitSeconds,
        uint256 _maxDailyWaitSeconds
    ) public {
        initialize(
            _controller,
            _minSingleWaitSeconds,
            _midSingleWaitSeconds,
            _maxSingleWaitSeconds,
            _minDailyWaitSeconds,
            _midDailyWaitSeconds,
            _maxDailyWaitSeconds
        );
    }

    function initialize(
        address _controller,
        uint256 _minSingleWaitSeconds,
        uint256 _midSingleWaitSeconds,
        uint256 _maxSingleWaitSeconds,
        uint256 _minDailyWaitSeconds,
        uint256 _midDailyWaitSeconds,
        uint256 _maxDailyWaitSeconds
    ) public initializer {
        require(
            IController(_controller).isController(),
            "Invalid controller contract!"
        );
        controller = _controller;

        __Ownable_init();

        minSingleWaitSeconds = _minSingleWaitSeconds;
        midSingleWaitSeconds = _midSingleWaitSeconds;
        maxSingleWaitSeconds = _maxSingleWaitSeconds;

        minDailyWaitSeconds = _minDailyWaitSeconds;
        midDailyWaitSeconds = _midDailyWaitSeconds;
        maxDailyWaitSeconds = _maxDailyWaitSeconds;
    }

    function _setAssetLimitConfig(
        address _asset,
        AssetLimitConfig calldata _newLimitConfig
    ) external onlyOwner {
        require(IController(controller).hasiToken(_asset), "Invalid asset!");

        assetLimitConfig[_asset] = AssetLimitConfig(
            _newLimitConfig.minSingleLimit,
            _newLimitConfig.midSingleLimit,
            _newLimitConfig.minDailyLimit,
            _newLimitConfig.midDailyLimit
        );

        // TODO:: Should reset `currentDailyAmount` if it is not zero?
        // Should `dailyStartTime` to be equal to current time?
        // Or it should be `block.timestamp / DAY * DAY`?
        assetData[_asset] = AssetData({
            currentDailyAmount: 0,
            dailyStartTime: block.timestamp
        });
    }

    function _setWhitelistExtraConfig(
        address _asset,
        address _account,
        AssetLimitConfig calldata _newLimitConfig
    ) external onlyOwner {
        require(IController(controller).hasiToken(_asset), "Invalid asset!");

        whitelistExtra[_asset][_account] = AssetLimitConfig(
            _newLimitConfig.minSingleLimit,
            _newLimitConfig.midSingleLimit,
            _newLimitConfig.minDailyLimit,
            _newLimitConfig.midDailyLimit
        );
    }

    function _getSingleWaitSeconds(
        uint256 _amount,
        AssetLimitConfig memory _config,
        AssetLimitConfig memory _extra
    ) internal view returns (uint256 _singleWaitSeconds) {
        // Single
        if (_amount <= _config.minSingleLimit.add(_extra.minSingleLimit)) {
            _singleWaitSeconds = minSingleWaitSeconds;
        } else if (
            _amount <= _config.midSingleLimit.add(_extra.midSingleLimit)
        ) {
            _singleWaitSeconds = midSingleWaitSeconds;
        } else {
            _singleWaitSeconds = maxSingleWaitSeconds;
        }
    }

    function _getCurrentDailyAmountAndState(
        uint256 _amount,
        AssetData memory _assetData
    )
        internal
        view
        returns (
            uint256 _currentTime,
            uint256 _currentDailyAmount,
            bool _toUpdate
        )
    {
        _currentTime = block.timestamp;

        if (_currentTime.sub(_assetData.dailyStartTime) < DAY) {
            // Accumulate value in the same day.
            _currentDailyAmount = _assetData.currentDailyAmount.add(_amount);
        } else {
            // Will reset value due to passing more than one day.
            _currentDailyAmount = _amount;
            _toUpdate = true;
        }
    }

    function _getDailyWaitSeconds(
        uint256 _currentDailyAmount,
        AssetLimitConfig memory _config,
        AssetLimitConfig memory _extra
    ) internal view returns (uint256 _dailyWaitSeconds) {
        // Daily
        if (
            _currentDailyAmount <=
            _config.minDailyLimit.add(_extra.minDailyLimit)
        ) {
            _dailyWaitSeconds = minDailyWaitSeconds;
        } else if (
            _currentDailyAmount <=
            _config.midDailyLimit.add(_extra.midDailyLimit)
        ) {
            _dailyWaitSeconds = midDailyWaitSeconds;
        } else {
            _dailyWaitSeconds = maxDailyWaitSeconds;
        }
    }

    function getDelayDetails(
        address _asset,
        uint256 _amount,
        address _caller
    )
        public
        view
        returns (
            uint256 _delaySeconds,
            uint256 _currentTime,
            uint256 _currentDailyAmount,
            bool _toUpdate
        )
    {
        AssetLimitConfig storage _config = assetLimitConfig[_asset];
        AssetLimitConfig storage _extra = whitelistExtra[_asset][_caller];
        AssetData storage _assetData = assetData[_asset];

        // Single
        _delaySeconds = _getSingleWaitSeconds(_amount, _config, _extra);

        (
            _currentTime,
            _currentDailyAmount,
            _toUpdate
        ) = _getCurrentDailyAmountAndState(_amount, _assetData);

        // Daily
        uint256 _dailyWaitSeconds = _getDailyWaitSeconds(
            _currentDailyAmount,
            _config,
            _extra
        );

        _delaySeconds = _delaySeconds.add(_dailyWaitSeconds);
    }

    function calculateTimeLockParams(
        address _asset,
        uint256 _amount,
        address _caller
    ) external returns (uint256 _delaySeconds) {
        require(msg.sender == controller, "Can only be called by controller!");
        require(IController(controller).hasiToken(_asset), "Invalid asset!");

        uint256 _currentTime;
        uint256 _currentDailyAmount;
        bool _toUpdate;

        (
            _delaySeconds,
            _currentTime,
            _currentDailyAmount,
            _toUpdate
        ) = getDelayDetails(_asset, _amount, _caller);

        AssetData storage _assetData = assetData[_asset];

        if (!_toUpdate) {
            // `_currentDailyAmount` has accumulated with input `_amount`.
            _assetData.currentDailyAmount = _currentDailyAmount;
        } else {
            // Will reset, so record input amount directly.
            _assetData.currentDailyAmount = _amount;
            _assetData.dailyStartTime = _currentTime.div(DAY).mul(DAY); // block.timestamp?
        }
    }
}
