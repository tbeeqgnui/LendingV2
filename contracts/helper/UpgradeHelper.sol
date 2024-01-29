// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../library/Ownable.sol";

interface IProxyAdmin {
    function upgrade(address proxy, address implementation) external;
}

interface IiToken {
    function isiToken() external view returns (bool);

    function underlying() external view returns (address);

    function _upgrade() external;

    function updateInterest() external;

    function _setInterestRateModel(address _newInterestRateModel) external;
}

interface IController {
    function getAlliTokens() external view returns (address[] memory);

    function _upgrade(
        address _controllerExtraImp,
        address _controllerExtraExp
    ) external;
}

interface ITimelock {
    function executeTransactions(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas
    ) external payable;
}

contract UpgradeHelper is Ownable {
    address immutable proxyAdmin;
    address immutable timelock;

    address immutable controller;
    address immutable controllerImpl;
    address immutable controllerExtraImp;
    address immutable controllerExtraExp;

    address immutable rewardDistributor;
    address immutable rewardDistributorImpl;

    address immutable iTokenImpl;
    address immutable iETHImpl;
    address immutable iMSDImpl;

    mapping(address => address) newInterestRateModels;

    constructor(
        address _proxyAdmin,
        address _timelock,
        address _controller,
        address _rewardDistributor,
        address _controllerImpl,
        address _controllerExtraImp,
        address _controllerExtraExp,
        address _rewardDistributorImpl,
        address _iTokenImpl,
        address _iETHImpl,
        address _iMSDImpl
    ) public {
        __Ownable_init();

        proxyAdmin = _proxyAdmin;
        timelock = _timelock;

        controller = _controller;
        rewardDistributor = _rewardDistributor;

        controllerImpl = _controllerImpl;
        controllerExtraImp = _controllerExtraImp;
        controllerExtraExp = _controllerExtraExp;
        rewardDistributorImpl = _rewardDistributorImpl;
        iTokenImpl = _iTokenImpl;
        iETHImpl = _iETHImpl;
        iMSDImpl = _iMSDImpl;
    }

    function _upgradeiTokens() internal {
        address[] memory _iTokens = IController(controller).getAlliTokens();

        uint256 _len = _iTokens.length;
        for (uint256 i = 0; i < _len; i++) {
            address _iTokenAddr = _iTokens[i];
            IiToken _iToken = IiToken(_iTokens[i]);

            uint size = 4;
            address[] memory targets = new address[](size);
            uint256[] memory values = new uint256[](size);
            string[] memory signatures = new string[](size);
            bytes[] memory calldatas = new bytes[](size);

            // _iToken.updateInterest();
            targets[0] = _iTokenAddr;
            values[0] = 0;
            signatures[0] = "updateInterest()";
            calldatas[0] = "";

            address implemetation = iTokenImpl;
            if (!_iToken.isiToken()) {
                implemetation = iMSDImpl;
            }
            if (address(_iToken.underlying()) == address(0)) {
                implemetation = iETHImpl;
            }

            // IProxyAdmin(proxyAdmin).upgrade(address(_iToken), implemetation);
            targets[1] = proxyAdmin;
            values[1] = 0;
            signatures[1] = "upgrade(address,address)";
            calldatas[1] = abi.encode(_iTokenAddr, implemetation);

            // _iToken._upgrade();
            targets[2] = _iTokenAddr;
            values[2] = 0;
            signatures[2] = "_upgrade()";
            calldatas[2] = "";

            // _iToken._setInterestRateModel(
            //     newInterestRateModels[address(_iToken)]
            // );
            targets[3] = _iTokenAddr;
            values[3] = 0;
            signatures[3] = "_setInterestRateModel(address)";
            calldatas[3] = abi.encode(newInterestRateModels[_iTokenAddr]);

            ITimelock(timelock).executeTransactions(
                targets,
                values,
                signatures,
                calldatas
            );
        }
    }

    function _upgradeController() internal {
        uint256 size = 3;
        address[] memory targets = new address[](size);
        uint256[] memory values = new uint256[](size);
        string[] memory signatures = new string[](size);
        bytes[] memory calldatas = new bytes[](size);
        uint256 i = 0;

        // IProxyAdmin(proxyAdmin).upgrade(controller, controllerImpl);
        targets[i] = proxyAdmin;
        values[i] = 0;
        signatures[i] = "upgrade(address,address)";
        calldatas[i++] = abi.encode(controller, controllerImpl);

        // IProxyAdmin(proxyAdmin).upgrade(
        //     rewardDistributor,
        //     rewardDistributorImpl
        // );
        targets[i] = proxyAdmin;
        values[i] = 0;
        signatures[i] = "upgrade(address,address)";
        calldatas[i++] = abi.encode(rewardDistributor, rewardDistributorImpl);

        // ControllerV2._upgrade() will call rewardDistributor._upgrade()
        // IController(controller)._upgrade(
        //     controllerExtraImp,
        //     controllerExtraExp
        // );
        targets[i] = controller;
        values[i] = 0;
        signatures[i] = "_upgrade(address,address)";
        calldatas[i++] = abi.encode(controllerExtraImp, controllerExtraExp);

        ITimelock(timelock).executeTransactions(
            targets,
            values,
            signatures,
            calldatas
        );
    }

    function upgrade() external onlyOwner {
        _upgradeiTokens();
        _upgradeController();
    }

    function _setInterestRateModelOf(
        address _iToken,
        address _irm
    ) external onlyOwner {
        newInterestRateModels[_iToken] = _irm;
    }

    function _setInterestRateModelsOf(
        address[] calldata _iTokens,
        address[] calldata _irms
    ) external onlyOwner {
        require(
            _iTokens.length == _irms.length,
            "Input arrays length mismatch!"
        );

        uint256 _len = _iTokens.length;
        for (uint256 i = 0; i < _len; i++) {
            newInterestRateModels[_iTokens[i]] = _irms[i];
        }
    }

    function acceptOwnershipOf(address _target) external onlyOwner {
        Ownable(_target)._acceptOwner();
    }

    function transferOwnershipOf(
        address _target,
        address payable _newOwner
    ) external onlyOwner {
        Ownable(_target)._setPendingOwner(_newOwner);
    }
}
