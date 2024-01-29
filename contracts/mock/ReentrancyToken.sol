// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Token.sol";

contract ReentrancyToken is Token {
    address public target;
    uint256 public value;
    string public signature;
    bytes public data;

    bool public set;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _actualDecimals
    ) public Token(_name, _symbol, _actualDecimals) {}

    function setCallData(
        address _target,
        uint256 _value,
        string calldata _signature,
        bytes calldata _data
    ) public {
        target = _target;
        value = _value;
        signature = _signature;
        data = _data;

        set = true;
    }

    function unsetCallData() public {
        set = false;
    }

    function executeTransaction() public payable returns (bytes memory) {
        bytes memory callData;
        require(
            bytes(signature).length > 0,
            "executeTransaction: Parameter signature can not be empty!"
        );
        callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call.value(value)(
            callData
        );

        if (success) {
            return returnData;
        } else {
            // Look for revert reason and bubble it up if present
            if (returnData.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert("executeTransaction: Transaction execution reverted");
            }
        }
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        if (set) executeTransaction();
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        if (set) executeTransaction();
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, allowance[sender][msg.sender].sub(amount));
        return true;
    }
}
