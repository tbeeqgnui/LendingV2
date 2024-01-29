//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";

interface IRewardRecipient {
    function rescueTokens(
        address _token,
        uint256 _amount,
        address _to
    ) external;
}

contract MockTreasury {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public rewardToken;

    constructor(address _rewardToken) public {
        rewardToken = IERC20Upgradeable(_rewardToken);
    }

    function addRecipient(address _recipient) public {
        rewardToken.safeApprove(_recipient, uint256(-1));
    }

    /**
     * @param _recipient The address staking pool to rescue token from.
     * @param _token The address of token to rescue.
     * @param _amount The amount of token to rescue.
     * @param _to The recipient of rescued token.
     */
    function rescueStakingPoolTokens(
        address _recipient,
        address _token,
        uint256 _amount,
        address _to
    ) external {
        IRewardRecipient(_recipient).rescueTokens(_token, _amount, _to);
    }
}
