// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./FVTokenBase.sol";

interface IController_ {
    /**
     * @return Return the distributor contract address
     */
    function rewardDistributor() external returns (address);
}

/**
 * @title dForce's Lending Protocol Contract.
 * @notice Flash Vault iTokens which wrap a protocol token underlying.
 * @author dForce Team.
 */
contract viToken is FVTokenBase {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Expects to call only once to initialize a new market.
     * @param _underlyingToken The underlying token address.
     * @param _name Token name.
     * @param _symbol Token symbol.
     * @param _controller Core controller contract address.
     * @param _interestRateModel Token interest rate model contract address.
     */
    function initialize(
        address _underlyingToken,
        string memory _name,
        string memory _symbol,
        IController _controller,
        IInterestRateModel _interestRateModel
    ) external initializer {
        __FVTokenBase_init(
            _underlyingToken,
            _name,
            _symbol,
            _controller,
            _interestRateModel
        );
    }

    /**
     * @dev Caller deposits assets into the market and `_recipient` receives iToken in exchange.
     * @param _recipient The account that would receive the iToken.
     * @param _mintAmount The amount of the underlying token to deposit.
     */
    function mint(
        address _recipient,
        uint256 _mintAmount
    ) external nonReentrant settleInterest onlyWhitelist(msg.sender) {
        _mintInternal(_recipient, _mintAmount);
    }

    /**
     * @dev Caller redeems specified iToken from `_from` to get underlying token.
     * @param _from The account that would burn the iToken.
     * @param _redeemiToken The number of iToken to redeem.
     */
    function redeem(
        address _from,
        uint256 _redeemiToken
    ) external nonReentrant settleInterest {
        _redeemInternal(
            _from,
            _redeemiToken,
            _redeemiToken.rmul(_exchangeRateInternal())
        );
    }

    /**
     * @notice Have permission to call this function, and it is only for the flash minter contract.
     * @dev Withdraws some iToken according to the amount of underlying without repaying borrowed assets
     *      at first, then uses these withdrawn iToken to redeem underlying, finally it should repay
     *      borrowed assets to ensure there is no any shortfall.
     */
    function flashRedeemUnderlying(
        uint256 _redeemUnderlying
    ) external nonReentrant settleInterest onlyWhitelist(msg.sender) {
        _flashRedeemInternal(
            msg.sender,
            _redeemUnderlying,
            _redeemUnderlying.rmul(_exchangeRateInternal())
        );
    }

    /**
     * @dev Claim rewards to `_recipient`.
     */
    function claimReward(address _recipient) external nonReentrant onlyOwner {
        IController_ _rewardController = IController_(
            IiToken(address(underlying)).controller()
        );
        IRewardDistributorV3 _distributor = IRewardDistributorV3(
            _rewardController.rewardDistributor()
        );
        address[] memory _holders = new address[](1);
        _holders[0] = address(this);
        _distributor.claimAllReward(_holders);

        IERC20Upgradeable _rewardToken = IERC20Upgradeable(
            _distributor.rewardToken()
        );
        uint256 _rewardBalance = _rewardToken.balanceOf(address(this));
        _rewardToken.safeTransfer(_recipient, _rewardBalance);
    }
}
