// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../library/Ownable.sol";

import "../library/SafeRatioMath.sol";

import "./interface/IDForceLending.sol";
import "./assetPriceModel/interface/IAssetPriceModel.sol";

/**
 * @notice The contract provides asset and user data in the lending market
 * @author dForce
 */
contract VaultDataV2 is Ownable {
    using SafeMathUpgradeable for uint256;
    using SafeRatioMath for uint256;

    uint256 constant BASE = 1e18;
    uint256 constant BASE_DECIMALS = 18;
    uint256 constant DAYS_PER_YEAR = 365;
    uint256 public blocksPerYear;

    bool private initialized;

    IiTokenHelper public priceToken;

    mapping(IiTokenHelper => IAssetPriceModel) public assetPriceModel;

    constructor(IiTokenHelper _priceToken, uint256 _blocksPerYear) public {
        initialize(_priceToken, _blocksPerYear);
    }

    function initialize(
        IiTokenHelper _priceToken,
        uint256 _blocksPerYear
    ) public {
        require(!initialized, "initialize: Already initialized!");
        __Ownable_init();
        priceToken = _priceToken;
        blocksPerYear = _blocksPerYear;
        initialized = true;
    }

    function setPriceToken(IiTokenHelper _newAsset) external onlyOwner {
        priceToken = _newAsset;
    }

    function setAssetPriceModel(
        IiTokenHelper _asset,
        IAssetPriceModel _assetPriceModel
    ) external onlyOwner {
        assetPriceModel[_asset] = _assetPriceModel;
    }

    function getBalance(
        IiTokenHelper _iToken,
        address _account
    ) public view returns (uint256) {
        return
            _iToken.underlying() == IERC20Upgradeable(0)
                ? _account.balance
                : _iToken.underlying().balanceOf(_account);
    }

    function getAvailableBalance(
        IiTokenHelper _iToken,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256 _underlyingBalance) {
        _underlyingBalance = getBalance(_iToken, _account);

        IiTokenHelper _underlying = IiTokenHelper(
            address(_iToken.underlying())
        );
        (bool _success, bytes memory _res) = address(_underlying).staticcall(
            abi.encodeWithSignature("isiToken()")
        );
        if (_success && _res.length == 32 && abi.decode(_res, (bool))) {
            // IiTokenHelper _underlying = IiTokenHelper(address(_iToken.underlying()));
            IControllerHelper _controller = _underlying.controller();
            (uint256 _collateralFactor, , , , , , ) = _controller.markets(
                _underlying
            );
            if (
                _controller.hasEnteredMarket(_account, _underlying) &&
                _collateralFactor > 0
            ) {
                (uint256 _equity, , , ) = calcAccountEquity(
                    _controller,
                    _account
                );
                uint256 _availableAmount = _equity
                    .div(
                        _controller.priceOracle().getUnderlyingPrice(
                            _underlying
                        )
                    )
                    .rdiv(_collateralFactor)
                    .rdiv(_underlying.exchangeRateStored())
                    .rmul(_safeMaxFactor);
                _underlyingBalance = _underlyingBalance > _availableAmount
                    ? _availableAmount
                    : _underlyingBalance;
            }
        }
    }

    function getAssetUSDPrice(
        IControllerHelper _controller,
        IiTokenHelper _iToken
    ) public returns (uint256) {
        uint256 _USDPrice = _controller.priceOracle().getUnderlyingPrice(
            priceToken
        );
        if (_USDPrice == 0) return 0;

        uint256 _assetUSDPrice = _controller
            .priceOracle()
            .getUnderlyingPrice(_iToken)
            .rdiv(_USDPrice);
        uint8 _assetDecimals = _iToken.decimals();
        uint8 _priceTokenDecimals = priceToken.decimals();

        return
            _assetDecimals > _priceTokenDecimals
                ? _assetUSDPrice.mul(
                    10 ** (uint256(_assetDecimals - _priceTokenDecimals))
                )
                : _assetUSDPrice.div(
                    10 ** (uint256(_priceTokenDecimals - _assetDecimals))
                );
    }

    function getValue(
        IControllerHelper _controller,
        IiTokenHelper _iToken,
        IiTokenHelper _priceToken,
        uint256 _amount
    ) public returns (uint256) {
        if (_amount == 0) return 0;

        IPriceOracleHelper _priceOracle = _controller.priceOracle();
        return
            _amount.mul(_priceOracle.getUnderlyingPrice(_iToken)).div(
                _priceOracle.getUnderlyingPrice(_priceToken)
            );
    }

    function getBaseValue(
        IControllerHelper _controller,
        IiTokenHelper _iToken,
        uint256 _amount
    ) public returns (uint256) {
        return getValue(_controller, _iToken, priceToken, _amount);
    }

    struct AccountEquityLocalVars {
        IiTokenHelper[] collateralITokens;
        IiTokenHelper[] borrowedITokens;
        uint256 collateralFactor;
        uint256 borrowFactor;
        uint256 sumCollateral;
        uint256 sumBorrowed;
    }

    function calcAccountEquity(
        IControllerHelper _controller,
        address _account
    ) public returns (uint256, uint256, uint256, uint256) {
        AccountEquityLocalVars memory _var;
        _var.collateralITokens = _controller.getEnteredMarkets(_account);
        for (uint256 i = 0; i < _var.collateralITokens.length; i++) {
            (_var.collateralFactor, , , , , , ) = _controller.markets(
                _var.collateralITokens[i]
            );
            _var.sumCollateral = _var.sumCollateral.add(
                _var
                    .collateralITokens[i]
                    .balanceOf(_account)
                    .mul(
                        _controller.priceOracle().getUnderlyingPrice(
                            _var.collateralITokens[i]
                        )
                    )
                    .rmul(_var.collateralITokens[i].exchangeRateStored())
                    .rmul(_var.collateralFactor)
            );
        }
        _var.borrowedITokens = _controller.getBorrowedAssets(_account);
        for (uint256 i = 0; i < _var.borrowedITokens.length; i++) {
            (, _var.borrowFactor, , , , , ) = _controller.markets(
                _var.borrowedITokens[i]
            );
            _var.sumBorrowed = _var.sumBorrowed.add(
                _var
                    .borrowedITokens[i]
                    .borrowBalanceStored(_account)
                    .mul(
                        _controller.priceOracle().getUnderlyingPrice(
                            _var.borrowedITokens[i]
                        )
                    )
                    .rdiv(_var.borrowFactor)
            );
        }
        return
            _var.sumCollateral > _var.sumBorrowed
                ? (
                    _var.sumCollateral - _var.sumBorrowed,
                    uint256(0),
                    _var.sumCollateral,
                    _var.sumBorrowed
                )
                : (
                    uint256(0),
                    _var.sumBorrowed - _var.sumCollateral,
                    _var.sumCollateral,
                    _var.sumBorrowed
                );
    }

    function calcSumCollateral(
        IControllerHelper _controller,
        IiTokenHelper _iToken,
        address _account,
        uint256 _collateralFactor,
        uint256 _addCollateralAmount
    ) public returns (uint256 _sumCollateral, uint256 _assetPrice) {
        _assetPrice = _controller.priceOracle().getUnderlyingPrice(_iToken);
        // if (_controller.hasEnteredMarket(_account, _iToken))
        _sumCollateral = _iToken
            .balanceOf(_account)
            .add(_addCollateralAmount)
            .mul(_assetPrice)
            .rmul(_iToken.exchangeRateStored())
            .rmul(_collateralFactor);
    }

    function calcSumBorrowed(
        IControllerHelper _controller,
        IiTokenHelper _iMSD,
        address _account,
        uint256 _borrowFactor,
        uint256 _repayAmount
    ) public returns (uint256 _sumBorrowed, uint256 _assetPrice) {
        _assetPrice = _controller.priceOracle().getUnderlyingPrice(_iMSD);
        uint256 _borrowAmount = _iMSD.borrowBalanceStored(_account);
        if (_borrowAmount > _repayAmount)
            _sumBorrowed = _borrowAmount
                .sub(_repayAmount)
                .mul(_assetPrice)
                .rdiv(_borrowFactor);
    }

    function getAccountBorrowStatus(
        IControllerHelper _controller,
        address _account
    ) public view returns (bool) {
        return _controller.getBorrowedAssets(_account).length > 0;
    }

    function getAccountAvailable(
        IControllerHelper _controller,
        address _account
    ) public view returns (bool) {
        IiTokenHelper[] memory _collateralITokens = _controller
            .getEnteredMarkets(_account);
        for (uint256 i = 0; i < _collateralITokens.length; i++) {
            if (
                !_controller.priceOracle().getAssetPriceStatus(
                    _collateralITokens[i]
                )
            ) return false;
        }
        IiTokenHelper[] memory _borrowedITokens = _controller.getBorrowedAssets(
            _account
        );
        for (uint256 i = 0; i < _borrowedITokens.length; i++) {
            if (
                !_controller.priceOracle().getAssetPriceStatus(
                    _borrowedITokens[i]
                )
            ) return false;
        }
        return true;
    }

    function getPoolInfo(
        IiTokenHelper _iMSD
    ) public returns (uint256 _supplyValue, uint256 _borrowValue) {
        IiTokenHelper _iToken = _iMSD.collateral();
        IControllerHelper _controller = _iToken.controller();

        _supplyValue = getBaseValue(
            _controller,
            _iToken,
            _iToken.totalSupply().rmul(_iToken.exchangeRateCurrent())
        );
        _borrowValue = getBaseValue(
            _controller,
            _iMSD,
            _iMSD.totalBorrowsCurrent()
        );
    }

    function getPoolsInfo(
        IiTokenHelper[] calldata _iMSDs
    )
        external
        returns (
            uint256 _totalSupplyValue,
            uint256 _totalBorrowValue,
            uint256 _collateralRatio
        )
    {
        uint256 _supplyValue;
        uint256 _borrowValue;
        for (uint256 i = 0; i < _iMSDs.length; i++) {
            (_supplyValue, _borrowValue) = getPoolInfo(_iMSDs[i]);
            _totalSupplyValue = _totalSupplyValue.add(_supplyValue);
            _totalBorrowValue = _totalBorrowValue.add(_borrowValue);
        }

        _collateralRatio = _totalBorrowValue == 0
            ? 0
            : _totalSupplyValue.rdiv(_totalBorrowValue);
    }

    function getCollateralData(
        IiTokenHelper _iMSD
    )
        external
        returns (
            uint256 _supplyValue,
            uint256 _collateralFactor,
            uint256 _collateralPrice,
            uint256 _liquidationIncentive
        )
    {
        IiTokenHelper _collateral = _iMSD.collateral();
        IControllerHelper _controller = _collateral.controller();
        _supplyValue = getBaseValue(
            _controller,
            _collateral,
            _collateral.totalSupply().rmul(_collateral.exchangeRateCurrent())
        );
        (_collateralFactor, , , , , , ) = _controller.markets(_collateral);
        _collateralPrice = getAssetUSDPrice(_controller, _collateral);
        _liquidationIncentive = _controller.liquidationIncentiveMantissa();
    }

    function getBorrowData(
        IiTokenHelper _iMSD
    )
        external
        returns (
            uint256 _totalBorrows,
            uint256 _borrowCapacity,
            uint256 _borrowable,
            uint256 _interestRate,
            uint256 _originationFeeRatio
        )
    {
        _totalBorrows = _iMSD.totalBorrowsCurrent();
        (, , _borrowCapacity, , , , ) = _iMSD.controller().markets(_iMSD);
        _borrowable = _totalBorrows > _borrowCapacity
            ? 0
            : _borrowCapacity - _totalBorrows;
        _interestRate =
            ((_iMSD.borrowRatePerBlock() *
                _iMSD.interestRateModel().blocksPerYear()) /
                DAYS_PER_YEAR +
                BASE).rpow(DAYS_PER_YEAR, BASE) -
            BASE;
        _originationFeeRatio = _iMSD.originationFeeRatio();
    }

    struct totalValueLocalVars {
        IControllerHelper controller;
        IPriceOracleHelper priceOracle;
        IiTokenHelper collateral;
        uint256 collateralFactor;
        uint256 borrowFactor;
        uint256 assetPrice;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 collateralAmount;
        uint256 collateralDecimals;
        uint256 collateralVaule;
        uint256 borrowAmount;
        uint256 borrowValue;
        uint256 liquidationPrice;
    }

    function getAccountInfo(
        IiTokenHelper _iMSD,
        address _account
    ) external returns (uint256, uint256, uint256, uint256, uint256) {
        totalValueLocalVars memory _var;
        _var.collateral = _iMSD.collateral();
        _var.controller = _var.collateral.controller();
        _var.priceOracle = _var.controller.priceOracle();
        _var.borrowAmount = _iMSD.borrowBalanceCurrent(_account);
        _var.borrowValue = _var.borrowAmount.mul(
            _var.priceOracle.getUnderlyingPrice(_iMSD)
        );

        _var.liquidationPrice = _var.borrowAmount == 0 ? uint256(-1) : 0;
        (_var.collateralFactor, , , , , , ) = _var.controller.markets(
            _var.collateral
        );
        if (
            _var.controller.hasEnteredMarket(_account, _var.collateral) &&
            _var.collateralFactor > 0
        ) {
            _var.collateralAmount = _var.collateral.balanceOfUnderlying(
                _account
            );

            if (_var.collateralAmount > 0) {
                _var.collateralDecimals = uint256(_var.collateral.decimals());
                _var.collateralDecimals = BASE_DECIMALS >
                    _var.collateralDecimals
                    ? BASE_DECIMALS - _var.collateralDecimals
                    : 0;
                _var.liquidationPrice = _var
                    .borrowValue
                    .rdiv(_var.collateralFactor)
                    .div(_var.collateralAmount)
                    .div(10 ** _var.collateralDecimals);
            }
        }

        _var.collateralVaule = _var.collateralAmount.mul(
            _var.priceOracle.getUnderlyingPrice(_var.collateral)
        );
        _var.sumCollateral = _var.collateralVaule.rmul(_var.collateralFactor);

        (, _var.borrowFactor, , , , , ) = _var.controller.markets(_iMSD);
        _var.sumBorrowed = _var.borrowValue.rdiv(_var.borrowFactor);

        _var.assetPrice = getAssetUSDPrice(_var.controller, priceToken);
        _var.collateralVaule = _var
            .collateralAmount
            .mul(_var.priceOracle.getUnderlyingPrice(_var.collateral))
            .div(_var.assetPrice);
        _var.borrowValue = _var.borrowValue.div(_var.assetPrice);

        return (
            _var.collateralAmount,
            _var.collateralVaule,
            _var.borrowValue,
            _var.liquidationPrice,
            _var.sumBorrowed == 0
                ? 0
                : _var.sumCollateral.rdiv(_var.sumBorrowed)
        );
    }

    struct supplyAndBorrowLocalVars {
        IControllerHelper controller;
        IiTokenHelper collateral;
        uint256 collateralFactor;
        uint256 collateralCapacity;
        uint256 borrowFactor;
        uint256 borrowCapacity;
        uint256 collateralExchangeRate;
        uint256 collateralTotalUnderlying;
        uint256 totalBorrows;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 borrowAssetPrice;
        uint256 accountCollateralBalance;
        uint256 accountMaxSupplyAmount;
        uint256 safeAvailableToBorrow;
        uint256 canBorrows;
    }

    function getAccountSupplyAndBorrowData(
        IiTokenHelper _iMSD,
        address _account,
        uint256 _supplyAmount,
        uint256 _safeBorrowMaxFactor,
        uint256 _safeSupplyMaxFactor
    ) public returns (uint256, uint256, uint256, uint256) {
        supplyAndBorrowLocalVars memory _var;
        _var.collateral = _iMSD.collateral();
        _var.controller = _var.collateral.controller();
        _var.accountCollateralBalance = getAvailableBalance(
            _var.collateral,
            _account,
            _safeSupplyMaxFactor
        );

        (_var.collateralFactor, , , _var.collateralCapacity, , , ) = _var
            .controller
            .markets(_var.collateral);
        _var.collateralExchangeRate = _var.collateral.exchangeRateCurrent();
        _var.collateralTotalUnderlying = _var.collateral.totalSupply().rmul(
            _var.collateralExchangeRate
        );
        _var.accountMaxSupplyAmount = 0;
        if (_var.collateralCapacity > _var.collateralTotalUnderlying) {
            _var.accountMaxSupplyAmount = _var.collateralCapacity.sub(
                _var.collateralTotalUnderlying
            );
            _var.accountMaxSupplyAmount = _var.accountMaxSupplyAmount >
                _var.accountCollateralBalance
                ? _var.accountCollateralBalance
                : _var.accountMaxSupplyAmount;
        }

        (_var.sumCollateral, ) = calcSumCollateral(
            _var.controller,
            _var.collateral,
            _account,
            _var.collateralFactor,
            _supplyAmount.rdiv(_var.collateralExchangeRate)
        );

        (, _var.borrowFactor, _var.borrowCapacity, , , , ) = _var
            .controller
            .markets(_iMSD);
        (_var.sumBorrowed, _var.borrowAssetPrice) = calcSumBorrowed(
            _var.controller,
            _iMSD,
            _account,
            _var.borrowFactor,
            0
        );

        _var.totalBorrows = _iMSD.totalBorrowsCurrent();
        _var.canBorrows = _var.totalBorrows >= _var.borrowCapacity
            ? 0
            : _var.borrowCapacity.sub(_var.totalBorrows);

        _var.safeAvailableToBorrow = _var.sumCollateral.rmul(
            _safeBorrowMaxFactor
        ) > _var.sumBorrowed
            ? _var.sumCollateral.rmul(_safeBorrowMaxFactor).sub(
                _var.sumBorrowed
            )
            : 0;
        _var.safeAvailableToBorrow = _var
            .safeAvailableToBorrow
            .rmul(_var.borrowFactor)
            .div(_var.borrowAssetPrice);

        _var.safeAvailableToBorrow = _var.safeAvailableToBorrow >
            _var.canBorrows
            ? _var.canBorrows
            : _var.safeAvailableToBorrow;

        return (
            _var.accountCollateralBalance,
            _var.accountMaxSupplyAmount,
            _var.safeAvailableToBorrow,
            _var.canBorrows
        );
    }

    struct repayAndRedeemLocalVars {
        IControllerHelper controller;
        IiTokenHelper collateral;
        uint256 collateralFactor;
        uint256 borrowFactor;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 accountEquity;
        uint256 collateralCash;
        uint256 availableCollateral;
        uint256 safeAvailableCollateral;
        uint256 collateralAssetPrice;
        uint256 accountBalance;
        uint256 borrowedBalance;
        uint256 maxRepay;
        uint256 iTokenBalance;
        uint256 suppliedBalance;
        uint256 availableToWithdraw;
        uint256 safeAvailableToWithdraw;
    }

    function getAccountRepayAndRedeemData(
        IiTokenHelper _iMSD,
        address _account,
        uint256 _repayAmount,
        uint256 _safeMaxFactor
    )
        public
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
    {
        repayAndRedeemLocalVars memory _var;

        _var.accountBalance = getBalance(_iMSD, _account);
        _var.borrowedBalance = _iMSD.borrowBalanceCurrent(_account);
        _var.maxRepay = _var.borrowedBalance > _var.accountBalance
            ? _var.accountBalance
            : _var.borrowedBalance;

        _var.collateral = _iMSD.collateral();
        _var.iTokenBalance = _var.collateral.balanceOf(_account);
        _var.suppliedBalance = _var.collateral.balanceOfUnderlying(_account);
        _var.collateralCash = _var.collateral.getCash();
        _var.availableToWithdraw = _var.collateralCash > _var.suppliedBalance
            ? _var.suppliedBalance
            : _var.collateralCash;
        _var.safeAvailableToWithdraw = _var.availableToWithdraw;

        if (_var.borrowedBalance > 0) {
            _var.controller = _var.collateral.controller();
            (_var.collateralFactor, , , , , , ) = _var.controller.markets(
                _var.collateral
            );
            (, _var.borrowFactor, , , , , ) = _var.controller.markets(_iMSD);
            (_var.sumCollateral, _var.collateralAssetPrice) = calcSumCollateral(
                _var.controller,
                _var.collateral,
                _account,
                _var.collateralFactor,
                0
            );
            (_var.sumBorrowed, ) = calcSumBorrowed(
                _var.controller,
                _iMSD,
                _account,
                _var.borrowFactor,
                _repayAmount
            );
            _var.accountEquity = _var.sumCollateral > _var.sumBorrowed
                ? _var.sumCollateral - _var.sumBorrowed
                : 0;

            if (
                (_var.collateralFactor == 0 && _var.accountEquity > 0) ||
                _var.sumBorrowed == 0
            )
                return (
                    _var.accountBalance,
                    _var.borrowedBalance,
                    _var.maxRepay,
                    _var.iTokenBalance,
                    _var.suppliedBalance,
                    _var.availableToWithdraw,
                    _var.safeAvailableToWithdraw
                );

            if (
                _var.collateralAssetPrice == 0 ||
                _var.collateralFactor == 0 ||
                _var.accountEquity == 0
            )
                return (
                    _var.accountBalance,
                    _var.borrowedBalance,
                    _var.maxRepay,
                    _var.iTokenBalance,
                    _var.suppliedBalance,
                    0,
                    0
                );

            _var.availableCollateral = _var
                .accountEquity
                .div(_var.collateralAssetPrice)
                .rdiv(_var.collateralFactor);
            _var.availableToWithdraw = _var.availableToWithdraw >
                _var.availableCollateral
                ? _var.availableCollateral
                : _var.availableToWithdraw;

            _var.safeAvailableCollateral = _var.sumCollateral >
                _var.sumBorrowed.rdiv(_safeMaxFactor)
                ? _var.sumCollateral.sub(_var.sumBorrowed.rdiv(_safeMaxFactor))
                : 0;
            _var.safeAvailableCollateral = _var
                .safeAvailableCollateral
                .div(_var.collateralAssetPrice)
                .rdiv(_var.collateralFactor);
            _var.safeAvailableToWithdraw = _var.safeAvailableToWithdraw >
                _var.safeAvailableCollateral
                ? _var.safeAvailableCollateral
                : _var.safeAvailableToWithdraw;

            _var.safeAvailableToWithdraw = _var.safeAvailableToWithdraw >
                _var.availableToWithdraw
                ? _var.availableToWithdraw
                : _var.safeAvailableToWithdraw;
        }

        return (
            _var.accountBalance,
            _var.borrowedBalance,
            _var.maxRepay,
            _var.iTokenBalance,
            _var.suppliedBalance,
            _var.availableToWithdraw,
            _var.safeAvailableToWithdraw
        );
    }

    struct liquidateLocalVars {
        IControllerHelper controller;
        IPriceOracleHelper oracle;
        uint256 priceBorrowed;
        uint256 priceCollateral;
        uint256 liquidatorBalance;
        uint256 borrowerCollateralBalance;
        uint256 shortfall;
        uint256 exchangeRateCollateral;
        uint256 maxRepay;
        uint256 maxSeizediToken;
        uint256 maxRepayByCollateral;
        bool available;
    }

    function getLiquidationInfo(
        address _borrower,
        address _liquidator,
        IiTokenHelper _assetBorrowed,
        IiTokenHelper _assetCollateral
    ) public returns (uint256, uint256, uint256, bool) {
        liquidateLocalVars memory _var;

        _var.controller = _assetBorrowed.controller();
        _var.oracle = _var.controller.priceOracle();
        if (_var.oracle.getAssetPriceStatus(_assetCollateral))
            _var.available = getAccountAvailable(_var.controller, _borrower);

        _var.maxRepay = _assetBorrowed.borrowBalanceCurrent(_borrower).rmul(
            _var.controller.closeFactorMantissa()
        );
        _var.exchangeRateCollateral = _assetCollateral.exchangeRateCurrent();

        _var.liquidatorBalance = getBalance(_assetBorrowed, _liquidator);
        (, _var.shortfall, , ) = calcAccountEquity(_var.controller, _borrower);
        if (_var.shortfall == 0 || _borrower == _liquidator)
            return (0, 0, _var.liquidatorBalance, _var.available);

        _var.priceBorrowed = _var.oracle.getUnderlyingPrice(_assetBorrowed);
        _var.priceCollateral = _var.oracle.getUnderlyingPrice(_assetCollateral);

        _var.maxSeizediToken = _var
            .maxRepay
            .mul(_var.priceBorrowed)
            .rmul(_var.controller.liquidationIncentiveMantissa())
            .rdiv(_var.exchangeRateCollateral)
            .div(_var.priceCollateral);
        _var.borrowerCollateralBalance = _assetCollateral.balanceOf(_borrower);
        if (_var.maxSeizediToken < _var.borrowerCollateralBalance)
            return (
                _var.maxRepay,
                _var.maxRepay,
                _var.liquidatorBalance,
                _var.available
            );

        _var.maxRepayByCollateral = _var
            .borrowerCollateralBalance
            .rmul(_var.exchangeRateCollateral)
            .mul(_var.priceCollateral)
            .div(_var.priceBorrowed)
            .rdiv(_var.controller.liquidationIncentiveMantissa());
        return (
            _var.maxRepay,
            _var.maxRepayByCollateral,
            _var.liquidatorBalance,
            _var.available
        );
    }

    function getAccountRewardAmount(
        IiTokenHelper _iMSD,
        address _account
    ) external returns (uint256) {
        IControllerHelper _controller = _iMSD.controller();
        IRewardDistributorHelper _rewardDistributor = _controller
            .rewardDistributor();
        address[] memory _accounts = new address[](1);
        _accounts[0] = _account;
        _rewardDistributor.updateRewardBatch(
            _accounts,
            _controller.getAlliTokens()
        );
        return _rewardDistributor.reward(_account);
    }

    function getDistributionSupplyApy(
        IiTokenHelper _asset
    ) external returns (uint256) {
        IControllerHelper _controller = _asset.controller();
        IPriceOracleHelper _priceOracle = _controller.priceOracle();

        uint256 _assetValue = _asset
            .totalSupply()
            .rmul(_asset.exchangeRateCurrent())
            .mul(_priceOracle.getUnderlyingPrice(_asset));

        if (_assetValue == 0) return 0;

        IRewardDistributorHelper _rewardDistributor = _controller
            .rewardDistributor();
        return
            _rewardDistributor
                .distributionSupplySpeed(_asset)
                .mul(blocksPerYear)
                .mul(rewardPrice(_rewardDistributor, _priceOracle))
                .rdiv(_assetValue);
    }

    function getDistributionBorrowApy(
        IiTokenHelper _asset
    ) external returns (uint256) {
        IControllerHelper _controller = _asset.controller();
        IPriceOracleHelper _priceOracle = _controller.priceOracle();

        uint256 _assetValue = _asset.totalBorrowsCurrent().mul(
            _priceOracle.getUnderlyingPrice(_asset)
        );

        if (_assetValue == 0) return 0;

        IRewardDistributorHelper _rewardDistributor = _controller
            .rewardDistributor();
        return
            _rewardDistributor
                .distributionSpeed(_asset)
                .mul(blocksPerYear)
                .mul(rewardPrice(_rewardDistributor, _priceOracle))
                .rdiv(_assetValue);
    }

    function rewardPrice(
        IRewardDistributorHelper _rewardDistributor,
        IPriceOracleHelper _priceOracle
    ) public returns (uint256) {
        IiTokenHelper _rewardToken = _rewardDistributor.rewardToken();
        IAssetPriceModel _assetPriceModel = assetPriceModel[_rewardToken];
        if (_assetPriceModel == IAssetPriceModel(0))
            return _priceOracle.getUnderlyingPrice(_rewardToken);

        return _assetPriceModel.getAssetPrice(address(_rewardToken));
    }

    function rewardTokenSymbol(
        IiTokenHelper _asset
    ) external view returns (string memory _symbol) {
        address _rewardToken = address(
            _asset.controller().rewardDistributor().rewardToken()
        );
        if (_rewardToken != address(0)) {
            (bool _success, bytes memory _res) = _rewardToken.staticcall(
                abi.encodeWithSignature("symbol()")
            );
            if (_success)
                _symbol = _res.length == 32
                    ? string(_res)
                    : abi.decode(_res, (string));
        }
    }
}
