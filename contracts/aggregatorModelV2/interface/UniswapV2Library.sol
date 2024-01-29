//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface UniswapV2Library {
    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}
