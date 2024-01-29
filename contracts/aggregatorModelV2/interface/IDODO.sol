//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IDSP {
    function decimals() external pure returns (uint8);

    function totalSupply() external view returns (uint256);

    function _BASE_TOKEN_() external view returns (address);

    function _QUOTE_TOKEN_() external view returns (address);

    function getVaultReserve()
        external
        view
        returns (uint256 baseReserve, uint256 quoteReserve);
}
