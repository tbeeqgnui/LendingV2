// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../library/Ownable.sol";

library SafeMath {
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }

    function div(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y > 0, "ds-math-div-overflow");
        z = x / y;
    }
}

library SafeRatioMath {
    using SafeMath for uint256;

    uint256 private constant BASE = 10 ** 18;

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y).div(BASE);
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).div(y);
    }

    function rpow(
        uint256 x,
        uint256 n,
        uint256 base
    ) internal pure returns (uint256 z) {
        assembly {
            switch x
            case 0 {
                switch n
                case 0 {
                    z := base
                }
                default {
                    z := 0
                }
            }
            default {
                switch mod(n, 2)
                case 0 {
                    z := base
                }
                default {
                    z := x
                }
                let half := div(base, 2) // for rounding.

                for {
                    n := div(n, 2)
                } n {
                    n := div(n, 2)
                } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) {
                        revert(0, 0)
                    }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) {
                        revert(0, 0)
                    }
                    x := div(xxRound, base)
                    if mod(n, 2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {
                            revert(0, 0)
                        }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) {
                            revert(0, 0)
                        }
                        z := div(zxRound, base)
                    }
                }
            }
        }
    }
}

/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see {ERC20Detailed}.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external;

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external;

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    // This function is not a standard ERC20 interface, just for compitable with market.
    function decimals() external view returns (uint8);
}

interface IInterestRateModel {
    function blocksPerYear() external view returns (uint256);
}

interface IPriceOracle {
    /**
     * @notice Get the underlying price of a iToken asset
     * @param _iToken The iToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18).
     *  Zero means the price is unavailable.
     */
    function getUnderlyingPrice(
        IiToken _iToken
    ) external view returns (uint256);

    /**
     * @notice Get the price of a underlying asset
     * @param _iToken The iToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18).
     *  Zero means the price is unavailable and whether the price is valid.
     */
    function getUnderlyingPriceAndStatus(
        IiToken _iToken
    ) external view returns (uint256, bool);

    function getAssetPriceStatus(IiToken _iToken) external view returns (bool);
}

interface IController {
    function getAlliTokens() external view returns (IiToken[] memory);

    function getEnteredMarkets(
        address _account
    ) external view returns (IiToken[] memory);

    function getBorrowedAssets(
        address _account
    ) external view returns (IiToken[] memory);

    function hasEnteredMarket(
        address _account,
        IiToken _iToken
    ) external view returns (bool);

    function hasBorrowed(
        address _account,
        IiToken _iToken
    ) external view returns (bool);

    function priceOracle() external view returns (IPriceOracle);

    function markets(
        IiToken _asset
    )
        external
        view
        returns (uint256, uint256, uint256, uint256, bool, bool, bool);

    function calcAccountEquity(
        address _account
    ) external view returns (uint256, uint256, uint256, uint256);

    function closeFactorMantissa() external view returns (uint256);

    function liquidationIncentiveMantissa() external view returns (uint256);

    function rewardDistributor() external view returns (address);
}

interface IiToken {
    function decimals() external view returns (uint8);

    function balanceOf(address _account) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function isSupported() external view returns (bool);

    function isiToken() external view returns (bool);

    function underlying() external view returns (IERC20);

    function getCash() external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function borrowRatePerBlock() external view returns (uint256);

    function balanceOfUnderlying(address _account) external returns (uint256);

    function borrowBalanceStored(
        address _account
    ) external view returns (uint256);

    function borrowBalanceCurrent(address _account) external returns (uint256);

    function totalBorrowsCurrent() external returns (uint256);

    function totalBorrows() external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function updateInterest() external returns (bool);

    function controller() external view returns (IController);

    function interestRateModel() external view returns (IInterestRateModel);

    function reserveRatio() external view returns (uint256);

    function originationFeeRatio() external view returns (uint256);

    function collateral() external view returns (IiToken);
}

/**
 * @notice The contract provides asset and user data in the lending market
 * @author dForce
 */
contract LendingDataMini is Ownable {
    using SafeMath for uint256;
    using SafeRatioMath for uint256;

    uint256 constant BASE = 1e18;
    uint256 constant BASE_DECIMALS = 18;
    uint256 constant DAYS_PER_YEAR = 365;

    bool private initialized;

    IiToken public priceToken;

    constructor(IiToken _priceToken) public {
        initialize(_priceToken);
    }

    function initialize(IiToken _priceToken) public {
        require(!initialized, "initialize: Already initialized!");
        __Ownable_init();
        priceToken = _priceToken;
        initialized = true;
    }

    function setPriceToken(IiToken _newAsset) external onlyOwner {
        priceToken = _newAsset;
    }

    function getBalance(
        IiToken _iToken,
        address _account
    ) public view returns (uint256) {
        return
            _iToken.underlying() == IERC20(0)
                ? _account.balance
                : _iToken.underlying().balanceOf(_account);
    }

    function getAvailableBalance(
        IiToken _iToken,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256 _underlyingBalance) {
        _underlyingBalance = getBalance(_iToken, _account);

        IiToken _underlying = IiToken(address(_iToken.underlying()));
        (bool _success, bytes memory _res) = address(_underlying).staticcall(
            abi.encodeWithSignature("isiToken()")
        );
        if (_success && _res.length == 32 && abi.decode(_res, (bool))) {
            // IiToken _underlying = IiToken(address(_iToken.underlying()));
            IController _controller = _underlying.controller();
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
        IController _controller,
        IiToken _iToken
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
        IController _controller,
        IiToken _iToken,
        IiToken _priceToken,
        uint256 _amount
    ) public returns (uint256) {
        if (_amount == 0) return 0;

        IPriceOracle _priceOracle = _controller.priceOracle();
        return
            _amount.mul(_priceOracle.getUnderlyingPrice(_iToken)).div(
                _priceOracle.getUnderlyingPrice(_priceToken)
            );
    }

    function getBaseValue(
        IController _controller,
        IiToken _iToken,
        uint256 _amount
    ) public returns (uint256) {
        return getValue(_controller, _iToken, priceToken, _amount);
    }

    struct AccountEquityLocalVars {
        IiToken[] collateralITokens;
        IiToken[] borrowedITokens;
        uint256 collateralFactor;
        uint256 borrowFactor;
        uint256 sumCollateral;
        uint256 sumBorrowed;
    }

    function calcAccountEquity(
        IController _controller,
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
        IController _controller,
        IiToken _iToken,
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
        IController _controller,
        IiToken _iMSD,
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
        IController _controller,
        address _account
    ) public view returns (bool) {
        return _controller.getBorrowedAssets(_account).length > 0;
    }

    function getAccountAvailable(
        IController _controller,
        address _account
    ) public view returns (bool) {
        IiToken[] memory _collateralITokens = _controller.getEnteredMarkets(
            _account
        );
        for (uint256 i = 0; i < _collateralITokens.length; i++) {
            if (
                !_controller.priceOracle().getAssetPriceStatus(
                    _collateralITokens[i]
                )
            ) return false;
        }
        IiToken[] memory _borrowedITokens = _controller.getBorrowedAssets(
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
        IiToken _iMSD
    ) public returns (uint256 _supplyValue, uint256 _borrowValue) {
        IiToken _iToken = _iMSD.collateral();
        IController _controller = _iToken.controller();

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
        IiToken[] calldata _iMSDs
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
        IiToken _iMSD
    )
        external
        returns (
            uint256 _supplyValue,
            uint256 _collateralFactor,
            uint256 _collateralPrice,
            uint256 _liquidationIncentive
        )
    {
        IiToken _collateral = _iMSD.collateral();
        IController _controller = _collateral.controller();
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
        IiToken _iMSD
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
        IController controller;
        IPriceOracle priceOracle;
        IiToken collateral;
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
        IiToken _iMSD,
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
        IController controller;
        IiToken collateral;
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
        IiToken _iMSD,
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
        IController controller;
        IiToken collateral;
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
        IiToken _iMSD,
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
        IController controller;
        IPriceOracle oracle;
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
        IiToken _assetBorrowed,
        IiToken _assetCollateral
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
}
