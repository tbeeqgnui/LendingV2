// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";

import "./interface/IDefaultTimeLock.sol";
import "./library/Ownable.sol";
import "./library/ReentrancyGuard.sol";
import "./library/Initializable.sol";

interface IController {
    function isController() external view returns (bool);
}

contract DefaultTimeLock is
    Initializable,
    ReentrancyGuard,
    Ownable,
    IDefaultTimeLock
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(uint256 => Agreement) private agreements;

    uint248 public agreementCount;
    bool public frozen;

    address public override controller;

    constructor(address _controller) public {
        initialize(_controller);
    }

    function initialize(address _controller) public initializer {
        require(
            IController(_controller).isController(),
            "Invalid controller contract!"
        );
        controller = _controller;

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function createAgreement(
        address _asset,
        uint256 _tokenAmounts,
        address _beneficiary,
        uint256 _releaseTime
    ) external override returns (uint256 agreementId) {
        require(msg.sender == controller, "Can only be called by controller!");
        // TODO: When will the following requirements be met?
        require(_beneficiary != address(0), "Beneficiary cant be zero address");
        require(_releaseTime > block.timestamp, "Release time not valid");

        agreementId = agreementCount++;
        agreements[agreementId] = Agreement({
            asset: _asset,
            tokenAmounts: _tokenAmounts,
            beneficiary: _beneficiary,
            releaseTime: _releaseTime,
            isFrozen: false
        });

        emit AgreementCreated(
            agreementId,
            _asset,
            _tokenAmounts,
            _beneficiary,
            _releaseTime
        );
    }

    function _validateAndDeleteAgreement(
        uint256 agreementId
    ) internal returns (Agreement memory agreement) {
        agreement = agreements[agreementId];
        require(
            block.timestamp >= agreement.releaseTime,
            "Release time not reached"
        );
        require(!agreement.isFrozen, "Agreement frozen");
        delete agreements[agreementId];

        emit AgreementClaimed(
            agreementId,
            agreement.asset,
            agreement.tokenAmounts,
            agreement.beneficiary
        );
    }

    function claim(
        uint256[] calldata agreementIds
    ) external override nonReentrant {
        require(!frozen, "TimeLock is frozen");

        for (uint256 index = 0; index < agreementIds.length; index++) {
            Agreement memory agreement = _validateAndDeleteAgreement(
                agreementIds[index]
            );

            // ETH
            if (agreement.asset == address(0)) {
                payable(agreement.beneficiary).transfer(agreement.tokenAmounts);
            } else {
                IERC20Upgradeable(agreement.asset).safeTransfer(
                    agreement.beneficiary,
                    agreement.tokenAmounts
                );
            }
        }
    }

    receive() external payable {}

    function _freezeAgreementInternal(uint256 agreementId) internal {
        // TODO:
        agreements[agreementId].isFrozen = true;
        emit AgreementFrozen(agreementId, true);
    }

    function freezeAgreements(
        uint256[] calldata agreementIds
    ) external override onlyOwner {
        uint256 _len = agreementIds.length;
        for (uint256 i = 0; i < _len; ++i) {
            _freezeAgreementInternal(agreementIds[i]);
        }
    }

    function _unfreezeAgreementInternal(uint256 agreementId) internal {
        // TODO:
        agreements[agreementId].isFrozen = false;
        emit AgreementFrozen(agreementId, false);
    }

    function unfreezeAgreements(
        uint256[] calldata agreementIds
    ) external override onlyOwner {
        uint256 _len = agreementIds.length;
        for (uint256 i = 0; i < _len; ++i) {
            _unfreezeAgreementInternal(agreementIds[i]);
        }
    }

    function _releaseAgreementInternal(uint256 agreementId) internal {
        agreements[agreementId].releaseTime = block.timestamp;
        emit AgreementReleased(agreementId);
    }

    function releaseAgreements(
        uint256[] calldata agreementIds
    ) external override onlyOwner {
        uint256 _len = agreementIds.length;
        for (uint256 i = 0; i < _len; ++i) {
            _releaseAgreementInternal(agreementIds[i]);
        }
    }

    function freezeClaim() external override onlyOwner {
        frozen = true;
        emit TimeLockFrozen(true);
    }

    function unfreezeClaim() external override onlyOwner {
        frozen = false;
        emit TimeLockFrozen(false);
    }

    function getAgreement(
        uint256 agreementId
    ) external view returns (Agreement memory agreement) {
        agreement = agreements[agreementId];
    }
}
