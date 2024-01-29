//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../../aggregatorModelV2/interface/IChainlinkAggregator.sol";
import "../interface/IDForceLending.sol";
import "./interface/IAssetPriceModel.sol";
import "./interface/IUniswapV3.sol";

contract UniV3PriceModel is IAssetPriceModel {
    using SafeMathUpgradeable for uint256;

    /// @dev UniswapV3 quoter contract address.
    IQuoter internal constant quoter =
        IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

    /// @dev Double decimal point constant for padding token decimal point.
    uint256 internal constant doubleDecimals_ = 36;

    /// @dev UniswapV3 pool contract address.
    IUniswapV3Pool public immutable pool;

    address public immutable tokenIn;
    address public immutable tokenOut;

    uint256 public immutable tokenInDecimal;

    uint256 public immutable tokenInDecimalScaler;
    uint256 public immutable tokenOutDecimalScaler;

    uint24 public immutable fee;

    IChainlinkAggregator public immutable transitAggregator;

    constructor(
        address _token,
        IUniswapV3Pool _pool,
        IChainlinkAggregator _transitAggregator
    ) public {
        address _token0 = _pool.token0();
        address _token1 = _pool.token1();
        require(_token == _token0 || _token == _token1, "");

        pool = _pool;
        (address _tokenIn, address _tokenOut) = _token == _token0
            ? (_token0, _token1)
            : (_token1, _token0);

        (tokenIn, tokenOut) = (_tokenIn, _tokenOut);

        tokenInDecimal = uint256(IiTokenHelper(_tokenIn).decimals());

        tokenInDecimalScaler =
            10 ** uint256(IiTokenHelper(_tokenIn).decimals());
        tokenOutDecimalScaler =
            10 ** uint256(IiTokenHelper(_tokenOut).decimals());

        fee = _pool.fee();

        transitAggregator = _transitAggregator;
    }

    /**
     * @notice Correct price.
     * @dev Correct price using price decimals and token decimals.
     * @param _tokenDecimals Token decimals.
     * @param _priceDecimals Price decimals.
     * @param _price Price.
     * @return Corrected price.
     */
    function _correctPrice(
        uint256 _tokenDecimals,
        uint256 _priceDecimals,
        uint256 _price
    ) internal pure virtual returns (uint256) {
        return
            _price.mul(
                10 ** (doubleDecimals_.sub(_tokenDecimals.add(_priceDecimals)))
            );
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _asset:Asset address
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     */
    function getAssetPrice(
        address _asset
    ) external virtual override returns (uint256 _assetPrice) {
        _asset;
        uint256 _amountOut = quoter.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            tokenInDecimalScaler,
            0
        );
        (, int256 _transitPrice, , , ) = transitAggregator.latestRoundData();
        if (_transitPrice > 0)
            _assetPrice = _correctPrice(
                tokenInDecimal,
                uint256(transitAggregator.decimals()),
                _amountOut.mul(uint256(_transitPrice)).div(
                    tokenOutDecimalScaler
                )
            );
    }
}
