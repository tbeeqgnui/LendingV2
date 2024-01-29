//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract MockL1Gateway {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function outboundTransfer(
        address l1Token,
        address to,
        uint256 amount,
        uint256, //maxGas,
        uint256, //gasPriceBid,
        bytes calldata data
    ) external payable returns (bytes memory) {
        // Assure the msg.sender has approved the l1Token
        IERC20Upgradeable(l1Token).safeTransferFrom(msg.sender, to, amount);

        return data;
    }
}
