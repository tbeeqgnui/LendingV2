// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./AggregatorModel.sol";

library Math {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }

    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

interface IiToken {
    function underlying() external view returns (address);
}

interface IPriceOracle {
    function getUnderlyingPrice(
        address _iToken
    ) external view returns (uint256);
}

interface IPair {
    function decimals() external pure returns (uint8);

    function totalSupply() external view returns (uint256);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract LPAggregatorModel is AggregatorModel {
    using Math for uint256;

    IPair private immutable lpToken;
    address private immutable token0;
    address private immutable token1;

    constructor(IPair _lpToken) public {
        lpToken = _lpToken;
        token0 = _lpToken.token0();
        token1 = _lpToken.token1();
    }

    /**
     * @notice Get the price of the token against the U.S. dollar (USDC) from uniswap.
     * @return The price of the asset aggregator (pathLast by decimals), zero under unexpected case.
     */
    function latestAnswer() external view override returns (int256) {
        int256 _price = int256(_getPrice(IPriceOracle(msg.sender), lpToken));
        return _price > 0 ? _price : 0;
    }

    /**
     * @notice represents the number of decimals the aggregator responses represent.
     * @return The decimal point of the aggregator.
     */
    function decimals() external view override returns (uint8) {
        return lpToken.decimals();
    }

    /**
     * @dev Used to query data of the pair.
     * @return lpToken address.
     * @return token0 address.
     * @return token1 address.
     */
    function getPairData() external view returns (IPair, address, address) {
        return (lpToken, token0, token1);
    }

    /**
     * @notice Retrieves price of an asset.
     * @dev Get price for an asset.
     * @param _priceOracle address of priceOracle to get asset price.
     * @param _lpToken Asset for which to get the price.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function getLpTokenPrice(
        IPriceOracle _priceOracle,
        IPair _lpToken
    ) external view returns (uint256) {
        return _getPrice(_priceOracle, _lpToken);
    }

    /**
     * @notice Retrieves price of an asset.
     * @dev Get price for an asset.
     * @param _priceOracle address of priceOracle to get asset price.
     * @param _lpToken LP asset for which to get the price.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function _getPrice(
        IPriceOracle _priceOracle,
        IPair _lpToken
    ) internal view returns (uint256) {
        (uint112 _reserve0, uint112 _reserve1, ) = _lpToken.getReserves();
        return
            _calcLpPrice(
                uint256(_reserve0),
                uint256(_reserve1),
                _priceOracle.getUnderlyingPrice(_lpToken.token0()),
                _priceOracle.getUnderlyingPrice(_lpToken.token1()),
                _lpToken.totalSupply()
            );
    }

    /**
     * @notice Only for LP asset.
     * @dev Calculate the price of LP asset.
     * @param _reserve0 the amount of token0 in LP asset.
     * @param _reserve1 the amount of token1 in LP asset.
     * @param _price0 the price of token0.
     * @param _price1 the price of token1.
     * @param _totalSupply totalSupply of LP asset.
     * @return The price of the asset (scaled by decimals), zero under unexpected case.
     */
    function _calcLpPrice(
        uint256 _reserve0,
        uint256 _reserve1,
        uint256 _price0,
        uint256 _price1,
        uint256 _totalSupply
    ) internal pure returns (uint256) {
        if (_totalSupply == 0) return 0;

        return
            (_reserve0.mul(_reserve1).sqrt().mul(_price0.mul(_price1).sqrt()) /
                _totalSupply).mul(2);
    }
}
