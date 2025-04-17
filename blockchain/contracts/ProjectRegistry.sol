// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ProjectRegistry is Ownable, Pausable {
    struct Project {
        uint256 id;
        string name;
        uint256 capacity;
        string location;
        uint256 totalInvestment;
        uint256 currentInvestment;
        ProjectStatus status;
        address owner;
        uint256 createdAt;
    }

    enum ProjectStatus {
        Pending,
        Active,
        Completed,
        Cancelled
    }

    mapping(uint256 => Project) public projects;
    mapping(address => bool) public kycVerified;
    uint256 public projectCount;

    event ProjectRegistered(uint256 indexed projectId, string name, address owner);
    event ProjectStatusUpdated(uint256 indexed projectId, ProjectStatus status);
    event KYCVerified(address indexed investor);

    error ProjectDoesNotExist();
    error InvalidStatus();
    error ProjectCompleted();
    error InvalidAddress();
    error AlreadyVerified();
    error EmptyName();
    error EmptyLocation();
    error ZeroCapacity();

    constructor() {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function registerProject(
        string memory name,
        uint256 capacity,
        string memory location
    ) external whenNotPaused {
        // Validate inputs
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(location).length == 0) revert EmptyLocation();
        if (capacity == 0) revert ZeroCapacity();

        uint256 projectId = projectCount++;
        projects[projectId] = Project({
            id: projectId,
            name: name,
            capacity: capacity,
            location: location,
            totalInvestment: 0,
            currentInvestment: 0,
            status: ProjectStatus.Pending,
            owner: msg.sender,
            createdAt: block.timestamp
        });

        emit ProjectRegistered(projectId, name, msg.sender);
    }

    function updateProjectStatus(uint256 projectId, uint256 newStatus) external {
        if (projectId >= projectCount) revert ProjectDoesNotExist();
        if (newStatus >= 4) revert InvalidStatus();
        
        require(projects[projectId].owner == msg.sender, "Not project owner");
        require(projects[projectId].status != ProjectStatus.Cancelled, "Project cancelled");
        if (projects[projectId].status == ProjectStatus.Completed) revert ProjectCompleted();

        projects[projectId].status = ProjectStatus(newStatus);
        emit ProjectStatusUpdated(projectId, ProjectStatus(newStatus));
    }

    function verifyKYC(address investor) external onlyOwner {
        if (investor == address(0)) revert InvalidAddress();
        if (kycVerified[investor]) revert AlreadyVerified();
        
        kycVerified[investor] = true;
        emit KYCVerified(investor);
    }

    function getProjectDetails(uint256 projectId) external view returns (
        uint256 id,
        string memory name,
        uint256 capacity,
        string memory location,
        uint256 totalInvestment,
        uint256 currentInvestment,
        ProjectStatus status,
        address owner,
        uint256 createdAt
    ) {
        if (projectId >= projectCount) revert ProjectDoesNotExist();
        
        Project memory project = projects[projectId];
        return (
            project.id,
            project.name,
            project.capacity,
            project.location,
            project.totalInvestment,
            project.currentInvestment,
            project.status,
            project.owner,
            project.createdAt
        );
    }

    function isKYCVerified(address investor) external view returns (bool) {
        return kycVerified[investor];
    }
}
