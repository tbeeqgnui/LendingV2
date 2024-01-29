//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./RewardDistributorV3.sol";

/**
 * @title dForce's lending reward distributor Contract
 * @author dForce
 */
contract RewardDistributorSecondV3 is RewardDistributorV3 {
    function _upgrade(address _iToken) external onlyController {
        distributionSupplyState[_iToken].timestamp = block.timestamp;

        distributionBorrowState[_iToken].timestamp = block.timestamp;
    }

    function _updateDistributionState(
        address _iToken,
        bool _isBorrow
    ) internal virtual override {
        require(controller.hasiToken(_iToken), "Token has not been listed");

        DistributionState storage state = _isBorrow
            ? distributionBorrowState[_iToken]
            : distributionSupplyState[_iToken];

        uint256 _speed = _isBorrow
            ? distributionSpeed[_iToken]
            : distributionSupplySpeed[_iToken];

        uint256 _blockTimestamp = block.timestamp;
        uint256 _deltaSecs = _blockTimestamp.sub(state.timestamp);

        if (_deltaSecs > 0 && _speed > 0) {
            uint256 _totalToken = _isBorrow
                ? IiToken(_iToken).totalBorrows().rdiv(
                    IiToken(_iToken).borrowIndex()
                )
                : IERC20Upgradeable(_iToken).totalSupply();
            uint256 _totalDistributed = _speed.mul(_deltaSecs);

            // Reward distributed per token since last time
            uint256 _distributedPerToken = _totalToken > 0
                ? _totalDistributed.rdiv(_totalToken)
                : 0;

            state.index = state.index.add(_distributedPerToken);
        }

        state.timestamp = _blockTimestamp;
    }
}
