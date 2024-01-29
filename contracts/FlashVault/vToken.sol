// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./FVTokenBase.sol";

/**
 * @title dForce's Lending Protocol Contract.
 * @notice Flash Vault iTokens which wrap a protocol token underlying.
 * @author dForce Team.
 */
contract vToken is FVTokenBase {
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
     * @dev Caller repays their own borrow.
     * @param _repayAmount The amount to repay.
     */
    function repayBorrow(
        uint256 _repayAmount
    ) external nonReentrant settleInterest onlyWhitelist(msg.sender) {
        _repayInternal(msg.sender, msg.sender, _repayAmount);
    }

    /**
     * @notice Have permission to call this function, and it is only for the flash vault contract.
     * @dev Borrows some USX without collaterals to the flash valut contract at first, then do any actions
     *      in the flash valut contract, finally, it should deposit collaterals to ensure there is
     *      no any shortfall.
     */
    function flashBorrow(
        uint256 _borrowAmount
    ) external nonReentrant settleInterest onlyWhitelist(msg.sender) {
        require(
            _borrowAmount > 0,
            "flashBorrow: Borrow amount can not be zero!"
        );

        // Borrow out USX to flash minter contract.
        _borrowInternal(msg.sender, _borrowAmount);
    }
}
