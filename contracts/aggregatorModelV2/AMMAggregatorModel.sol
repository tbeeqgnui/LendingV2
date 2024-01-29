// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./AggregatorModelV2.sol";

import "./interface/UniswapV2Library.sol";

contract AMMAggregatorModel is AggregatorModelV2 {
    UniswapV2Library private immutable router;
    address[] private path;
    uint256 private immutable pathLast;
    uint256 private immutable baseAmount;

    constructor(UniswapV2Library _router, address[] memory _path) public {
        router = _router;
        require(_path.length > 1, "_path length must be greater than 1!");
        path = _path;
        pathLast = _path.length - 1;
        baseAmount = 10 ** uint256(ERC20(_path[0]).decimals());
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external override returns (uint256 _assetPrice, uint8 _decimals) {
        _asset;
        _assetPrice = router.getAmountsOut(baseAmount, path)[pathLast];
        _decimals = ERC20(path[pathLast]).decimals();
    }

    /**
     * @notice represents the number of decimals the aggregator responses represent.
     * @return The decimal point of the aggregator.
     */
    function decimals() external view returns (uint8) {
        return ERC20(path[pathLast]).decimals();
    }

    /**
     * @notice the version number representing the type of aggregator the proxy points to.
     * @return The aggregator version is uint256(-1).
     */
    function version() external view override returns (uint256) {
        return uint256(-1);
    }

    /**
     * @dev Used to query the source address of the router.
     * @return Router address.
     */
    function getRouter() external view returns (UniswapV2Library) {
        return router;
    }

    /**
     * @dev Used to query the source address of the router path.
     * @return Router path address list
     */
    function getPath() external view returns (address[] memory) {
        return path;
    }

    /**
     * @dev performs chained getAmountOut calculations on any number of pairs.
     * @return Exchange amount list
     */
    function getAmountsOut(
        UniswapV2Library _router,
        uint256 _amount,
        address[] calldata _path
    ) external view returns (uint256[] memory) {
        return _router.getAmountsOut(_amount, _path);
    }
}
