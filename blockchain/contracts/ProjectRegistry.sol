// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ProjectRegistry is Ownable, Pausable {
    struct ProjectBase {
        uint256 id;
        string name;
        string description;
        address owner;
        uint256 createdAt;
        ProjectStatus status;
    }

    struct ProjectFinancials {
        uint256 totalInvestment;
        uint256 currentInvestment;
        uint256 targetAmount;
        uint256 minInvestment;
        uint256 maxInvestment;
    }

    struct ProjectTechnical {
        uint256 capacity;
        string location;
        address tokenAddress;
    }

    enum ProjectStatus {
        Pending,
        Active,
        Completed,
        Cancelled
    }

    mapping(uint256 => ProjectBase) public projectsBase;
    mapping(uint256 => ProjectFinancials) public projectsFinancials;
    mapping(uint256 => ProjectTechnical) public projectsTechnical;
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
    error InvalidInvestmentLimits();
    error InvalidTokenAddress();

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function registerProject(
        string calldata name,
        string calldata description,
        uint256 targetAmount,
        uint256 minInvestment,
        uint256 maxInvestment,
        address tokenAddress
    ) external whenNotPaused {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(description).length == 0) revert EmptyName();
        if (targetAmount == 0) revert ZeroCapacity();
        if (minInvestment == 0 || maxInvestment < minInvestment) revert InvalidInvestmentLimits();
        if (tokenAddress == address(0)) revert InvalidTokenAddress();

        uint256 projectId = projectCount++;
        
        projectsBase[projectId] = ProjectBase({
            id: projectId,
            name: name,
            description: description,
            owner: msg.sender,
            createdAt: block.timestamp,
            status: ProjectStatus.Pending
        });

        projectsFinancials[projectId] = ProjectFinancials({
            totalInvestment: 0,
            currentInvestment: 0,
            targetAmount: targetAmount,
            minInvestment: minInvestment,
            maxInvestment: maxInvestment
        });

        projectsTechnical[projectId] = ProjectTechnical({
            capacity: 0,
            location: "",
            tokenAddress: tokenAddress
        });

        emit ProjectRegistered(projectId, name, msg.sender);
    }

    function updateProjectStatus(uint256 projectId, uint256 newStatus) external {
        if (projectId >= projectCount) revert ProjectDoesNotExist();
        if (newStatus >= 4) revert InvalidStatus();
        
        ProjectBase storage project = projectsBase[projectId];
        if (project.owner != msg.sender) revert InvalidAddress();
        if (project.status == ProjectStatus.Cancelled) revert ProjectCompleted();
        if (project.status == ProjectStatus.Completed) revert ProjectCompleted();

        project.status = ProjectStatus(newStatus);
        emit ProjectStatusUpdated(projectId, ProjectStatus(newStatus));
    }

    function verifyKYC(address investor) external onlyOwner {
        if (investor == address(0)) revert InvalidAddress();
        if (kycVerified[investor]) revert AlreadyVerified();
        
        kycVerified[investor] = true;
        emit KYCVerified(investor);
    }

    function getProjectDetails(uint256 projectId) external view returns (
        ProjectBase memory base,
        ProjectFinancials memory financials,
        ProjectTechnical memory technical
    ) {
        if (projectId >= projectCount) revert ProjectDoesNotExist();
        return (
            projectsBase[projectId],
            projectsFinancials[projectId],
            projectsTechnical[projectId]
        );
    }

    function isKYCVerified(address investor) external view returns (bool) {
        return kycVerified[investor];
    }

    function getProjectToken(uint256 projectId) external view returns (address) {
        if (projectId >= projectCount) revert ProjectDoesNotExist();
        return projectsTechnical[projectId].tokenAddress;
    }
}
