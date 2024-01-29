// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "./AggregatorModelV2.sol";

import "./interface/IChainlinkAggregator.sol";
import "./interface/IYearnVault.sol";

contract YearnAggregatorModel is AggregatorModelV2 {
    using SafeMathUpgradeable for uint256;

    IChainlinkAggregator internal immutable assetAggregator;
    IYearnVault internal immutable yearnVault;
    uint256 internal immutable weiPerToken;

    constructor(
        IChainlinkAggregator _assetAggregator,
        IYearnVault _yearnVault
    ) public {
        assetAggregator = _assetAggregator;
        yearnVault = _yearnVault;
        weiPerToken = 10 ** _yearnVault.decimals();
    }

    /**
     * @notice Reads the current answer from aggregator delegated to.
     * @param _assetPrice:The price of the asset aggregator (scaled by decimals), zero under unexpected case.
     * @param _decimals:Asset price decimals
     */
    function getAssetPrice(
        address _asset
    ) external virtual override returns (uint256 _assetPrice, uint8 _decimals) {
        _asset;
        (, int256 _assetAggregatorPrice, , , ) = assetAggregator
            .latestRoundData();
        if (_assetAggregatorPrice > 0)
            _assetPrice = uint256(_assetAggregatorPrice)
                .mul(yearnVault.pricePerShare())
                .div(weiPerToken);

        _decimals = assetAggregator.decimals();
    }

    /**
     * @notice represents the number of decimals the aggregator responses represent.
     * @return The decimal point of the aggregator.
     */
    function decimals() external view returns (uint8) {
        return assetAggregator.decimals();
    }

    /**
     * @notice the version number representing the type of aggregator the proxy points to.
     * @return The aggregator version is uint256(-1).
     */
    function version() external view override returns (uint256) {
        return uint256(-1);
    }

    /**
     * @dev Used to query the source address of the aggregator.
     * @return Asset aggregator address.
     */
    function getAggregators() external view returns (IChainlinkAggregator) {
        return assetAggregator;
    }

    /**
     * @notice returns the description of the aggregator the proxy points to.
     */
    function description() external view returns (string memory) {
        return assetAggregator.description();
    }

    /**
     * @notice returns the information of the yearnVault.
     * @return yearnVault symbol.
     *         yearnVault address.
     *         yearnVault decimals.
     *         yearnVault wei per token.
     */
    function yearnVaultInfo()
        external
        view
        returns (string memory, IYearnVault, uint256, uint256)
    {
        return (
            yearnVault.symbol(),
            yearnVault,
            yearnVault.decimals(),
            weiPerToken
        );
    }
}
