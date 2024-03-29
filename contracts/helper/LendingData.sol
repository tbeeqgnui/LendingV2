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

    function secsPerYear() external view returns (uint256);
}

interface IPriceOracle {
    /**
     * @notice Get the underlying price of a iToken asset
     * @param iToken The iToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18).
     *  Zero means the price is unavailable.
     */
    function getUnderlyingPrice(IiToken iToken) external view returns (uint256);
}

interface IRewardDistributor {
    function updateDistributionState(IiToken _iToken, bool _isBorrow) external;

    function updateReward(
        IiToken _iToken,
        address _account,
        bool _isBorrow
    ) external;

    function updateRewardBatch(
        address[] memory _holders,
        IiToken[] memory _iTokens
    ) external;

    function reward(address _account) external view returns (uint256);
}

interface IController {
    function getAlliTokens() external view returns (IiToken[] memory);

    function getEnteredMarkets(
        address _account
    ) external view returns (address[] memory);

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

    function beforeRedeem(
        address iToken,
        address redeemer,
        uint256 redeemAmount
    ) external returns (bool);

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

    function supplyRatePerUnit() external view returns (uint256);

    function borrowRatePerUnit() external view returns (uint256);

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

    function interestRateModel() external view returns (IInterestRateModel);
}

contract LendingData is Ownable {
    using SafeMath for uint256;
    using SafeRatioMath for uint256;
    bool private initialized;

    uint256 constant BASE = 1e18;

    uint256 constant blocksPerYear = 4 * 60 * 24 * 365;
    uint256 constant daysPerYear = 365;

    IController public controller;
    IiToken public priceToken;

    IiToken[] public tokens;
    uint256[] public amounts;
    uint8[] public decimals;

    constructor(address _controller, IiToken _priceToken) public {
        initialize(_controller, _priceToken);
    }

    function initialize(address _controller, IiToken _priceToken) public {
        require(!initialized, "initialize: Already initialized!");
        __Ownable_init();
        controller = IController(_controller);
        priceToken = _priceToken;
        initialized = true;
    }

    function setController(IController _newController) external onlyOwner {
        // Sets to new controller.
        controller = _newController;
    }

    function setPriceToken(IiToken _newAsset) external onlyOwner {
        priceToken = _newAsset;
    }

    struct totalValueLocalVars {
        IiToken[] iTokens;
        IController controller;
        IPriceOracle priceOracle;
        uint256 assetPrice;
        uint256 collateralFactor;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 supplyValue;
        uint256 collateralVaule;
        uint256 borrowValue;
    }

    function _getAccountTotalValue(
        address _account,
        bool _testFlag
    ) internal returns (uint256, uint256, uint256, uint256) {
        totalValueLocalVars memory _var;
        _var.controller = controller;
        _var.iTokens = _var.controller.getAlliTokens();
        _var.priceOracle = _var.controller.priceOracle();
        for (uint256 i = 0; i < _var.iTokens.length; i++) {
            _var.assetPrice = _var.priceOracle.getUnderlyingPrice(
                _var.iTokens[i]
            );
            _var.supplyValue = _var.supplyValue.add(
                _var.iTokens[i].balanceOfUnderlying(_account).mul(
                    _var.assetPrice
                )
            );
            (_var.collateralFactor, , , , , , ) = controller.markets(
                _var.iTokens[i]
            );
            if (
                _var.controller.hasEnteredMarket(_account, _var.iTokens[i]) &&
                _var.collateralFactor > 0
            )
                _var.collateralVaule = _var.collateralVaule.add(
                    _var.iTokens[i].balanceOfUnderlying(_account).mul(
                        _var.assetPrice
                    )
                );

            if (_var.controller.hasBorrowed(_account, _var.iTokens[i]))
                _var.borrowValue = _var.borrowValue.add(
                    _var.iTokens[i].borrowBalanceCurrent(_account).mul(
                        _var.assetPrice
                    )
                );
        }
        _var.assetPrice = _testFlag
            ? _var.priceOracle.getUnderlyingPrice(priceToken)
            : getAssetUSDPrice(priceToken);
        if (_var.assetPrice == 0) return (0, 0, 0, 0);

        _var.supplyValue = _var.supplyValue.div(_var.assetPrice);
        _var.collateralVaule = _var.collateralVaule.div(_var.assetPrice);
        _var.borrowValue = _var.borrowValue.div(_var.assetPrice);
        (, , _var.sumCollateral, _var.sumBorrowed) = controller
            .calcAccountEquity(_account);
        return (
            _var.supplyValue,
            _var.collateralVaule,
            _var.borrowValue,
            _var.sumBorrowed == 0
                ? (_testFlag ? uint256(-1) : 0)
                : _var.sumCollateral.rdiv(_var.sumBorrowed)
        );
    }

    function getAccountTotalValue(
        address _account
    ) external returns (uint256, uint256, uint256, uint256) {
        return _getAccountTotalValue(_account, false);
    }

    function getAccountTotalValueForTest(
        address _account
    ) external returns (uint256, uint256, uint256, uint256) {
        return _getAccountTotalValue(_account, true);
    }

    function getAccountAssetStatus(
        IiToken _asset,
        address _account,
        uint256 _type
    ) internal returns (bool, uint256) {
        uint256 _balance;
        if (_type == 0) {
            _balance = _asset.balanceOfUnderlying(_account);
            return (_balance == 0 ? false : true, _balance);
        }

        bool _isiToken = _asset.isiToken();
        if ((_type & 1 > 0 && _isiToken) || (_type & 2 > 0 && !_isiToken))
            _balance = _asset.borrowBalanceCurrent(_account);

        return (_balance == 0 ? false : true, _balance);
    }

    function getAccountAssets(
        address _account,
        uint256 _type
    ) internal returns (IiToken[] memory, uint256[] memory, uint8[] memory) {
        delete tokens;
        delete amounts;
        delete decimals;
        uint256 _balance;
        bool _status;
        IiToken[] memory _iTokens = controller.getAlliTokens();
        for (uint256 i = 0; i < _iTokens.length; i++) {
            (_status, _balance) = getAccountAssetStatus(
                _iTokens[i],
                _account,
                _type
            );
            if (_status) {
                tokens.push(_iTokens[i]);
                amounts.push(_balance);
                decimals.push(_iTokens[i].decimals());
            }
        }

        return (tokens, amounts, decimals);
    }

    function getAccountSupplyTokens(
        address _account
    ) public returns (IiToken[] memory, uint256[] memory, uint8[] memory) {
        return getAccountAssets(_account, 0);
    }

    function getAccountBorrowTokens(
        address _account
    ) public returns (IiToken[] memory, uint256[] memory, uint8[] memory) {
        return getAccountAssets(_account, 1);
    }

    function getAccountMSDTokens(
        address _account
    ) public returns (IiToken[] memory, uint256[] memory, uint8[] memory) {
        return getAccountAssets(_account, 2);
    }

    function getAccountTokens(
        address _account
    )
        external
        returns (
            IiToken[] memory _supplyTokens,
            uint256[] memory _supplyAmounts,
            uint8[] memory _supplyDecimals,
            IiToken[] memory _borrowTokens,
            uint256[] memory _borrowAmounts,
            uint8[] memory _borrowDecimals
        )
    {
        (_supplyTokens, _supplyAmounts, _supplyDecimals) = getAccountAssets(
            _account,
            0
        );
        (_borrowTokens, _borrowAmounts, _borrowDecimals) = getAccountAssets(
            _account,
            3
        );
    }

    function getAssetUSDPrice(IiToken _asset) public view returns (uint256) {
        uint256 _USDPrice = controller.priceOracle().getUnderlyingPrice(
            priceToken
        );
        if (_USDPrice == 0) return 0;

        uint256 _assetUSDPrice = controller
            .priceOracle()
            .getUnderlyingPrice(_asset)
            .rdiv(_USDPrice);
        uint8 _assetDecimals = _asset.decimals();
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

    function _unitsPerDay(IiToken _asset) internal view returns (uint256) {
        try _asset.interestRateModel().secsPerYear() returns (
            uint256 _secsPerYear
        ) {
            return _secsPerYear / daysPerYear;
        } catch {
            return _asset.interestRateModel().blocksPerYear() / daysPerYear;
        }
    }

    function _supplyRatePerUnit(
        IiToken _asset
    ) internal view returns (uint256) {
        try _asset.supplyRatePerUnit() returns (uint256 _supplyRatePerUnit) {
            return _supplyRatePerUnit;
        } catch {
            return _asset.supplyRatePerBlock();
        }
    }

    function _borrowRatePerUnit(
        IiToken _asset
    ) internal view returns (uint256) {
        try _asset.borrowRatePerUnit() returns (uint256 _borrowRatePerUnit) {
            return _borrowRatePerUnit;
        } catch {
            return _asset.borrowRatePerBlock();
        }
    }

    function getSupplyTokenData(
        IiToken _asset
    ) public view returns (uint256, uint256, uint256) {
        (uint256 _collateralFactor, , , , , , ) = controller.markets(_asset);
        if (_asset.isiToken()) {
            // uint256 _interestPerDay = _supplyRatePerUnit() * _unitsPerDay();
            uint256 _interestPerDay = _asset.supplyRatePerUnit() *
                _unitsPerDay(_asset);
            return (
                (_interestPerDay + BASE).rpow(daysPerYear, BASE) - BASE,
                _collateralFactor,
                getAssetUSDPrice(_asset)
            );
        }
        return (0, _collateralFactor, getAssetUSDPrice(_asset));
    }

    function getAccountSupplyInfo(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256 _assetPrice, bool _asCollateral, bool _executed) {
        _asCollateral = controller.hasEnteredMarket(_account, _asset);
        if (!_asCollateral) {
            (uint256 _collateralFactor, , , , , , ) = controller.markets(
                _asset
            );
            _executed = _collateralFactor > 0 ? true : false;
        } else {
            _executed = canAccountRemoveFromCollateral(
                _asset,
                _account,
                _safeMaxFactor
            );
        }

        uint256 _USDPrice = controller.priceOracle().getUnderlyingPrice(
            priceToken
        );
        _assetPrice = _USDPrice == 0
            ? 0
            : getBalance(_asset, _account)
                .mul(controller.priceOracle().getUnderlyingPrice(_asset))
                .div(_USDPrice);
    }

    struct removeFromCollateralLocalVars {
        uint256 assetPrice;
        uint256 collateralFactor;
        uint256 accountEquity;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 safeAvailableToken;
    }

    function canAccountRemoveFromCollateral(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (bool) {
        if (getAccountBorrowStatus(_account)) {
            removeFromCollateralLocalVars memory _var;

            (_var.collateralFactor, , , , , , ) = controller.markets(_asset);
            (
                _var.accountEquity,
                ,
                _var.sumCollateral,
                _var.sumBorrowed
            ) = controller.calcAccountEquity(_account);
            if (_var.collateralFactor == 0 && _var.accountEquity > 0)
                return true;

            _var.assetPrice = controller.priceOracle().getUnderlyingPrice(
                _asset
            );
            if (
                _var.assetPrice == 0 ||
                _var.collateralFactor == 0 ||
                _var.accountEquity == 0
            ) return false;

            _var.safeAvailableToken = _var.sumCollateral >
                _var.sumBorrowed.rdiv(_safeMaxFactor)
                ? _var.sumCollateral.sub(_var.sumBorrowed.rdiv(_safeMaxFactor))
                : 0;
            _var.safeAvailableToken = _var
                .safeAvailableToken
                .div(_var.assetPrice)
                .rdiv(_var.collateralFactor);

            return
                _var.safeAvailableToken >=
                IiToken(_asset).balanceOfUnderlying(_account);
        }

        return true;
    }

    struct supplyLocalVars {
        uint256 cash;
        uint256 assetPrice;
        uint256 collateralFactor;
        uint256 supplyCapacity;
        uint256 totalUnderlying;
        uint256 accountEquity;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 availableToken;
        uint256 safeAvailableToken;
        uint256 suppliedBalance;
        uint256 accountBalance;
        uint256 maxMintAmount;
        uint256 availableToWithdraw;
        uint256 safeAvailableToWithdraw;
        uint256 iTokenBalance;
        uint8 decimals;
    }

    function _getAccountSupplyData(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor,
        bool _testFlag
    )
        internal
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint8)
    {
        supplyLocalVars memory _var;
        _var.suppliedBalance = _asset.balanceOfUnderlying(_account);
        _var.accountBalance = getBalance(_asset, _account);
        _var.iTokenBalance = _asset.balanceOf(_account);
        _var.decimals = _asset.decimals();

        _var.maxMintAmount = 0;
        (_var.collateralFactor, , , _var.supplyCapacity, , , ) = controller
            .markets(_asset);
        _var.totalUnderlying = _asset.totalSupply().rmul(
            _asset.exchangeRateStored()
        );
        if (_var.supplyCapacity > _var.totalUnderlying) {
            _var.maxMintAmount = _var.supplyCapacity.sub(_var.totalUnderlying);
            _var.maxMintAmount = _var.maxMintAmount > _var.accountBalance
                ? _var.accountBalance
                : _var.maxMintAmount;
        }

        if (_asset.isiToken()) {
            _var.cash = _asset.getCash();
            _var.availableToWithdraw = _var.cash > _var.suppliedBalance
                ? _var.suppliedBalance
                : _var.cash;
        }
        _var.safeAvailableToWithdraw = _var.availableToWithdraw;

        if (
            controller.hasEnteredMarket(_account, _asset) &&
            getAccountBorrowStatus(_account)
        ) {
            (
                _var.accountEquity,
                ,
                _var.sumCollateral,
                _var.sumBorrowed
            ) = controller.calcAccountEquity(_account);
            if (_var.collateralFactor == 0 && _var.accountEquity > 0)
                return (
                    _var.suppliedBalance,
                    _var.accountBalance,
                    _var.maxMintAmount,
                    _var.availableToWithdraw,
                    _var.safeAvailableToWithdraw,
                    _var.iTokenBalance,
                    _var.decimals
                );

            _var.assetPrice = controller.priceOracle().getUnderlyingPrice(
                _asset
            );
            if (
                _var.assetPrice == 0 ||
                _var.collateralFactor == 0 ||
                _var.accountEquity == 0
            )
                return (
                    _var.suppliedBalance,
                    _var.accountBalance,
                    _var.maxMintAmount,
                    0,
                    0,
                    _testFlag ? _var.iTokenBalance : 0,
                    _var.decimals
                );

            _var.availableToken = _var.accountEquity.div(_var.assetPrice).rdiv(
                _var.collateralFactor
            );
            _var.availableToWithdraw = _var.availableToWithdraw >
                _var.availableToken
                ? _var.availableToken
                : _var.availableToWithdraw;

            _var.safeAvailableToken = _var.sumCollateral >
                _var.sumBorrowed.rdiv(_safeMaxFactor)
                ? _var.sumCollateral.sub(_var.sumBorrowed.rdiv(_safeMaxFactor))
                : 0;
            _var.safeAvailableToken = _var
                .safeAvailableToken
                .div(_var.assetPrice)
                .rdiv(_var.collateralFactor);
            _var.safeAvailableToWithdraw = _var.safeAvailableToWithdraw >
                _var.safeAvailableToken
                ? _var.safeAvailableToken
                : _var.safeAvailableToWithdraw;

            _var.safeAvailableToWithdraw = _var.safeAvailableToWithdraw >
                _var.availableToWithdraw
                ? _var.availableToWithdraw
                : _var.safeAvailableToWithdraw;
        }

        return (
            _var.suppliedBalance,
            _var.accountBalance,
            _var.maxMintAmount,
            _var.availableToWithdraw,
            _var.safeAvailableToWithdraw,
            _var.iTokenBalance,
            _var.decimals
        );
    }

    function getAccountSupplyData(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    )
        public
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint8)
    {
        return _getAccountSupplyData(_asset, _account, _safeMaxFactor, false);
    }

    function getAccountSupplyDataForTest(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    )
        public
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint8)
    {
        return _getAccountSupplyData(_asset, _account, _safeMaxFactor, true);
    }

    function getAccountBorrowValue(
        address _account
    ) public returns (uint256 _borrowValue) {
        IiToken[] memory _iTokens = controller.getAlliTokens();
        IPriceOracle _priceOracle = controller.priceOracle();
        for (uint256 i = 0; i < _iTokens.length; i++) {
            if (controller.hasBorrowed(_account, _iTokens[i]))
                _borrowValue = _borrowValue.add(
                    _iTokens[i].borrowBalanceCurrent(_account).mul(
                        _priceOracle.getUnderlyingPrice(_iTokens[i])
                    )
                );
        }
        return _borrowValue;
    }

    function getAccountBorrowStatus(
        address _account
    ) public view returns (bool) {
        IiToken[] memory _iTokens = controller.getAlliTokens();
        for (uint256 i = 0; i < _iTokens.length; i++)
            if (_iTokens[i].borrowBalanceStored(_account) > 0) return true;

        return false;
    }

    function getBorrowTokenData(
        IiToken _asset
    ) public view returns (uint256, uint256, uint256, uint256) {
        if (_asset.isSupported()) {
            (, uint256 _borrowFactor, , , , , ) = controller.markets(_asset);
            uint256 _interestPerDay = _borrowRatePerUnit(_asset) *
                _unitsPerDay(_asset);
            return (
                _asset.getCash(),
                _borrowFactor,
                (_interestPerDay + BASE).rpow(daysPerYear, BASE) - BASE,
                getAssetUSDPrice(_asset)
            );
        }
        return (0, 0, 0, 0);
    }

    struct borrowInfoLocalVars {
        IPriceOracle oracle;
        uint256 assetPrice;
        uint256 USDPrice;
        uint256 accountEquity;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 borrowFactor;
        uint256 maxBorrowValue;
        uint256 safeBorrowValue;
    }

    function getAccountBorrowInfo(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256, uint256, uint256) {
        borrowInfoLocalVars memory _var;
        _var.oracle = controller.priceOracle();
        _var.USDPrice = _var.oracle.getUnderlyingPrice(priceToken);
        if (_var.USDPrice == 0) return (0, 0, 0);

        IiToken(_asset).updateInterest();
        (
            _var.accountEquity,
            ,
            _var.sumCollateral,
            _var.sumBorrowed
        ) = controller.calcAccountEquity(_account);
        (, _var.borrowFactor, , , , , ) = controller.markets(_asset);

        _var.maxBorrowValue = _var.accountEquity.rmul(_var.borrowFactor).div(
            _var.USDPrice
        );
        _var.safeBorrowValue = _var.sumCollateral.rmul(_safeMaxFactor) >
            _var.sumBorrowed
            ? _var.sumCollateral.rmul(_safeMaxFactor).sub(_var.sumBorrowed)
            : 0;
        _var.safeBorrowValue = _var.safeBorrowValue.rmul(_var.borrowFactor).div(
            _var.USDPrice
        );

        _var.assetPrice = _var.oracle.getUnderlyingPrice(_asset);
        return (
            _var.maxBorrowValue,
            _var.safeBorrowValue,
            getBalance(_asset, _account).mul(_var.assetPrice).div(_var.USDPrice)
        );
    }

    struct borrowLocalVars {
        uint256 cash;
        uint256 assetPrice;
        uint256 borrowCapacity;
        uint256 accountEquity;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 borrowFactor;
        uint256 totalBorrows;
        uint256 canBorrows;
        uint256 borrowedBalance;
        uint256 availableToBorrow;
        uint256 safeAvailableToBorrow;
        uint256 accountBalance;
        uint256 maxRepay;
    }

    function _getAccountBorrowData(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor,
        bool _testFlag
    ) internal returns (uint256, uint256, uint256, uint256, uint256, uint8) {
        borrowLocalVars memory _var;
        _var.borrowedBalance = _asset.borrowBalanceCurrent(_account);
        _var.accountBalance = getBalance(_asset, _account);
        _var.maxRepay = _var.borrowedBalance > _var.accountBalance
            ? _var.accountBalance
            : _var.borrowedBalance;

        _var.assetPrice = controller.priceOracle().getUnderlyingPrice(_asset);
        (, _var.borrowFactor, _var.borrowCapacity, , , , ) = controller.markets(
            _asset
        );
        if (
            _var.assetPrice == 0 ||
            _var.borrowCapacity == 0 ||
            _var.borrowFactor == 0
        )
            return (
                _var.borrowedBalance,
                0,
                0,
                _var.accountBalance,
                _var.maxRepay,
                _asset.decimals()
            );

        (
            _var.accountEquity,
            ,
            _var.sumCollateral,
            _var.sumBorrowed
        ) = controller.calcAccountEquity(_account);
        _var.availableToBorrow = _var.accountEquity.rmul(_var.borrowFactor).div(
            _var.assetPrice
        );

        _var.safeAvailableToBorrow = _var.sumCollateral.rmul(_safeMaxFactor) >
            _var.sumBorrowed
            ? _var.sumCollateral.rmul(_safeMaxFactor).sub(_var.sumBorrowed)
            : 0;
        _var.safeAvailableToBorrow = _var
            .safeAvailableToBorrow
            .rmul(_var.borrowFactor)
            .div(_var.assetPrice);

        if (_asset.isiToken()) {
            _var.cash = _asset.getCash();
            _var.availableToBorrow = _var.availableToBorrow > _var.cash
                ? _var.cash
                : _var.availableToBorrow;

            _var.safeAvailableToBorrow = _var.safeAvailableToBorrow > _var.cash
                ? _var.cash
                : _var.safeAvailableToBorrow;
        }

        _var.totalBorrows = _asset.totalBorrowsCurrent();
        _var.canBorrows = _var.totalBorrows >= _var.borrowCapacity
            ? 0
            : _var.borrowCapacity.sub(_var.totalBorrows);

        _var.availableToBorrow = _var.availableToBorrow > _var.canBorrows
            ? _var.canBorrows
            : _var.availableToBorrow;

        _var.safeAvailableToBorrow = _var.safeAvailableToBorrow >
            _var.canBorrows
            ? _var.canBorrows
            : _var.safeAvailableToBorrow;

        return (
            _var.borrowedBalance,
            _testFlag ? _var.availableToBorrow : _var.canBorrows,
            _var.safeAvailableToBorrow,
            _var.accountBalance,
            _var.maxRepay,
            _asset.decimals()
        );
    }

    function getAccountBorrowData(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256, uint256, uint256, uint256, uint256, uint8) {
        return _getAccountBorrowData(_asset, _account, _safeMaxFactor, false);
    }

    function getAccountBorrowDataForTest(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor
    ) public returns (uint256, uint256, uint256, uint256, uint256, uint8) {
        return _getAccountBorrowData(_asset, _account, _safeMaxFactor, true);
    }

    struct availableToBorrowLocalVars {
        uint256 borrowFactor;
        uint256 accountEquity;
        uint256 sumCollateral;
        uint256 sumBorrowed;
        uint256 availableToBorrow;
        uint256 safeAvailableToBorrow;
    }

    function calcAccountAvailableToBorrow(
        IiToken _asset,
        address _account,
        uint256 _safeMaxFactor,
        uint256 _assetPrice
    ) public view returns (uint256, uint256) {
        availableToBorrowLocalVars memory _var;
        (, _var.borrowFactor, , , , , ) = controller.markets(_asset);
        if (_assetPrice == 0 || _var.borrowFactor == 0) return (0, 0);

        (
            _var.accountEquity,
            ,
            _var.sumCollateral,
            _var.sumBorrowed
        ) = controller.calcAccountEquity(_account);
        _var.availableToBorrow = _var.accountEquity.rmul(_var.borrowFactor).div(
            _assetPrice
        );

        _var.safeAvailableToBorrow = _var.sumCollateral.rmul(_safeMaxFactor) >
            _var.sumBorrowed
            ? _var.sumCollateral.rmul(_safeMaxFactor).sub(_var.sumBorrowed)
            : 0;
        _var.safeAvailableToBorrow = _var
            .safeAvailableToBorrow
            .rmul(_var.borrowFactor)
            .div(_assetPrice);

        return (_var.availableToBorrow, _var.safeAvailableToBorrow);
    }

    function getBalance(
        IiToken _asset,
        address _account
    ) public view returns (uint256) {
        return
            _asset.underlying() == IERC20(0)
                ? _account.balance
                : _asset.underlying().balanceOf(_account);
    }

    struct liquidateLocalVars {
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
    }

    function getLiquidationInfo(
        address _borrower,
        address _liquidator,
        IiToken _assetBorrowed,
        IiToken _assetCollateral
    ) public returns (uint256, uint256, uint256) {
        liquidateLocalVars memory _var;

        _var.maxRepay = _assetBorrowed.borrowBalanceCurrent(_borrower).rmul(
            controller.closeFactorMantissa()
        );
        _var.exchangeRateCollateral = _assetCollateral.exchangeRateCurrent();

        _var.liquidatorBalance = getBalance(_assetBorrowed, _liquidator);
        (, _var.shortfall, , ) = controller.calcAccountEquity(_borrower);
        if (_var.shortfall == 0 || _borrower == _liquidator)
            return (0, 0, _var.liquidatorBalance);

        _var.oracle = controller.priceOracle();
        _var.priceBorrowed = _var.oracle.getUnderlyingPrice(_assetBorrowed);
        _var.priceCollateral = _var.oracle.getUnderlyingPrice(_assetCollateral);

        _var.maxSeizediToken = _var
            .maxRepay
            .mul(_var.priceBorrowed)
            .rmul(controller.liquidationIncentiveMantissa())
            .rdiv(_var.exchangeRateCollateral)
            .div(_var.priceCollateral);
        _var.borrowerCollateralBalance = _assetCollateral.balanceOf(_borrower);
        if (_var.maxSeizediToken < _var.borrowerCollateralBalance)
            return (_var.maxRepay, _var.maxRepay, _var.liquidatorBalance);

        _var.maxRepayByCollateral = _var
            .borrowerCollateralBalance
            .rmul(_var.exchangeRateCollateral)
            .mul(_var.priceCollateral)
            .div(_var.priceBorrowed)
            .rdiv(controller.liquidationIncentiveMantissa());
        return (
            _var.maxRepay,
            _var.maxRepayByCollateral,
            _var.liquidatorBalance
        );
    }

    function getAccountRewardAmount(
        address _account
    ) external returns (uint256) {
        IRewardDistributor _rewardDistributor = IRewardDistributor(
            controller.rewardDistributor()
        );
        address[] memory _accounts = new address[](1);
        _accounts[0] = _account;
        _rewardDistributor.updateRewardBatch(
            _accounts,
            controller.getAlliTokens()
        );
        return _rewardDistributor.reward(_account);
    }
}
