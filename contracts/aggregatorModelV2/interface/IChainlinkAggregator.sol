//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IChainlinkAggregator {
    function latestAnswer() external view returns (int256);

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80);

    function latestTimestamp() external view returns (uint256);

    function latestRound() external view returns (uint256);

    function getAnswer(uint256 roundId) external view returns (int256);

    function getTimestamp(uint256 roundId) external view returns (uint256);

    function decimals() external view returns (uint8);

    function description() external view returns (string memory);
}
