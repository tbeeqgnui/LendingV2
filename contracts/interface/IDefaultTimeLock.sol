// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/** @title ITimeLock interface for the TimeLock smart contract */
interface IDefaultTimeLock {
    /** @dev Struct representing a time-lock agreement
     * @param isFrozen Indicates if the agreement is frozen
     * @param asset Address of the asset
     * @param beneficiary Address of the beneficiary
     * @param releaseTime Timestamp when the assets can be claimed
     * @param tokenAmounts Token amounts
     */
    struct Agreement {
        bool isFrozen;
        address asset;
        address beneficiary;
        uint256 releaseTime;
        uint256 tokenAmounts;
    }

    /** @notice Event emitted when a new time-lock agreement is created
     * @param agreementId ID of the created agreement
     * @param asset Address of the asset
     * @param tokenAmounts Token amounts
     * @param beneficiary Address of the beneficiary
     * @param releaseTime Timestamp when the assets can be claimed
     */
    event AgreementCreated(
        uint256 agreementId,
        address indexed asset,
        uint256 tokenAmounts,
        address indexed beneficiary,
        uint256 releaseTime
    );

    /** @notice Event emitted when a time-lock agreement is claimed
     * @param agreementId ID of the claimed agreement
     * @param asset Address of the asset
     * @param tokenAmounts Token amounts
     * @param beneficiary Address of the beneficiary
     */
    event AgreementClaimed(
        uint256 agreementId,
        address indexed asset,
        uint256 tokenAmounts,
        address indexed beneficiary
    );

    /** @notice Event emitted when a time-lock agreement is frozen or unfrozen
     * @param agreementId ID of the affected agreement
     * @param value Indicates whether the agreement is frozen (true) or unfrozen (false)
     */
    event AgreementFrozen(uint256 agreementId, bool value);

    /** @notice Event emitted when a time-lock agreement is released
     * @param agreementId ID of the affected agreement
     */
    event AgreementReleased(uint256 agreementId);

    /** @notice Event emitted when the entire TimeLock contract is frozen or unfrozen
     * @param value Indicates whether the contract is frozen (true) or unfrozen (false)
     */
    event TimeLockFrozen(bool value);

    /** @dev Function to create a new time-lock agreement
     * @param asset Address of the asset
     * @param tokenAmounts Token amounts
     * @param beneficiary Address of the beneficiary
     * @param releaseTime Timestamp when the assets can be claimed
     * @return agreementId Returns the ID of the created agreement
     */
    function createAgreement(
        address asset,
        uint256 tokenAmounts,
        address beneficiary,
        uint256 releaseTime
    ) external returns (uint256 agreementId);

    /** @dev Function to claim assets from time-lock agreements
     * @param agreementIds Array of agreement IDs to be claimed
     */
    function claim(uint256[] calldata agreementIds) external;

    /** @dev Function to freeze some time-lock agreements
     * @param agreementIds Array of agreement IDs to be frozen
     */
    function freezeAgreements(uint256[] calldata agreementIds) external;

    /** @dev Function to unfreeze some time-lock agreements
     * @param agreementIds Array of agreement IDs to be unfrozen
     */
    function unfreezeAgreements(uint256[] calldata agreementIds) external;

    /** @dev Function to release some time-lock agreements
     * @param agreementIds Array of agreement IDs to be release
     */

    function releaseAgreements(uint256[] calldata agreementIds) external;

    /** @dev Function to freeze the claim function
     * @notice This function can only be called by an authorized user
     */
    function freezeClaim() external;

    /** @dev Function to unfreeze the claim function
     * @notice This function can only be called by an authorized user
     */
    function unfreezeClaim() external;

    function controller() external view returns (address);
}
