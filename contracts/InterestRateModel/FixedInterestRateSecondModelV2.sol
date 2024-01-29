// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../library/Ownable.sol";

interface IInterestRateModelClient {
    function updateInterest() external returns (bool);
}

/**
 * @title dForce's Fixed Interest Rate Model Contract
 * @author dForce
 */
contract FixedInterestRateSecondModelV2 is Ownable {
    // ratePerSecond must not exceed this value
    uint256 internal constant ratePerSecondMax = 0.001e18;

    /**
     * @notice The approximate number of seconds produced each year
     * @dev This is not used internally, but is expected externally for an interest rate model
     */
    uint256 public constant secondsPerYear = 60 * 60 * 24 * 365;

    /**
     * @notice Borrow interest rates per second
     */
    mapping(address => uint256) public borrowRatesPerSecond;

    /**
     * @notice Supply interest rates per second
     */
    mapping(address => uint256) public supplyRatesPerSecond;

    /**
     * @dev Emitted when borrow rate for `target` is set to `rate`.
     */
    event BorrowRateSet(address target, uint256 rate);

    /**
     * @dev Emitted when supply rate for `target` is set to `rate`.
     */
    event SupplyRateSet(address target, uint256 rate);

    constructor() public {
        __Ownable_init();
    }

    /*********************************/
    /******** Security Check *********/
    /*********************************/

    /**
     * @notice Ensure this is an interest rate second model contract.
     */
    function isInterestRateSecondModel() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Get the current borrow rate per second
     * @param cash Not used by this model.
     * @param borrows Not used by this model.
     * @param reserves Not used by this model.
     * @return Current borrow rate per second (as a percentage, and scaled by 1e18).
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public view returns (uint256) {
        cash;
        borrows;
        reserves;
        return borrowRatesPerSecond[msg.sender];
    }

    /**
     * @dev Get the current supply interest rate per second.
     * @param cash Not used by this model.
     * @param borrows Not used by this model.
     * @param reserves Not used by this model.
     * @param reserveRatio Not used by this model.
     * @return The supply rate per second (as a percentage, and scaled by 1e18).
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveRatio
    ) external view returns (uint256) {
        cash;
        borrows;
        reserves;
        reserveRatio;
        return supplyRatesPerSecond[msg.sender];
    }

    /**
     * @notice Admin function to set the current borrow rate per second
     */
    function _setBorrowRate(address _target, uint256 _rate) public onlyOwner {
        require(_rate <= ratePerSecondMax, "Borrow rate invalid");

        // Settle interest before setting new one
        IInterestRateModelClient(_target).updateInterest();

        borrowRatesPerSecond[_target] = _rate;

        emit BorrowRateSet(_target, _rate);
    }

    /**
     * @notice Admin function to set the current supply interest rate per second
     */
    function _setSupplyRate(address _target, uint256 _rate) public onlyOwner {
        require(_rate <= ratePerSecondMax, "Supply rate invalid");

        // Settle interest before setting new one
        IInterestRateModelClient(_target).updateInterest();

        supplyRatesPerSecond[_target] = _rate;

        emit SupplyRateSet(_target, _rate);
    }

    /**
     * @notice Admin function to set the borrow interest rates per second for targets
     */
    function _setBorrowRates(
        address[] calldata _targets,
        uint256[] calldata _rates
    ) external onlyOwner {
        require(
            _targets.length == _rates.length,
            "Targets and rates length mismatch!"
        );

        uint256 _len = _targets.length;
        for (uint256 i = 0; i < _len; i++) {
            _setBorrowRate(_targets[i], _rates[i]);
        }
    }

    /**
     * @notice Admin function to set the supply interest rates per second for the targets
     */
    function _setSupplyRates(
        address[] calldata _targets,
        uint256[] calldata _rates
    ) external onlyOwner {
        require(
            _targets.length == _rates.length,
            "Targets and rates length mismatch!"
        );

        uint256 _len = _targets.length;
        for (uint256 i = 0; i < _len; i++) {
            _setSupplyRate(_targets[i], _rates[i]);
        }
    }
}
