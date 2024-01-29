//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ITimeLockStrategy {
    function calculateTimeLockParams(
        address _asset,
        uint256 _amount,
        address _caller
    ) external returns (uint256 _delayTime);

    function controller() external view returns (address);
}
