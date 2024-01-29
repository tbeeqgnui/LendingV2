//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCBridge {
    using SafeERC20 for IERC20;

    function addLiquidity(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    }
}
