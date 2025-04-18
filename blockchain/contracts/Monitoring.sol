// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ProjectRegistry.sol";

/**
 * @title Monitoring
 * @dev Contract for monitoring energy production from renewable energy assets
 */
contract Monitoring is Ownable, Pausable {
    struct ProductionData {
        uint256 timestamp;
        uint256 energyProduced; // in Wh
        uint256 peakPower; // in W
        int256 temperature; // in Celsius * 100 (2 decimal places)
        uint256 irradiance; // in W/m²
    }

    struct Sensor {
        string sensorType;
        bool isActive;
        uint256 lastUpdate;
        address authorizedUpdater;
    }

    ProjectRegistry public projectRegistry;
    
    // Project ID => Timestamp => Production Data
    mapping(uint256 => mapping(uint256 => ProductionData)) public productionHistory;
    
    // Project ID => Latest Production Data
    mapping(uint256 => ProductionData) public latestProduction;
    
    // Project ID => Sensor ID => Sensor
    mapping(uint256 => mapping(bytes32 => Sensor)) public sensors;

    // Events
    event ProductionDataUpdated(uint256 indexed projectId, uint256 timestamp, uint256 energyProduced);
    event SensorRegistered(uint256 indexed projectId, bytes32 indexed sensorId, string sensorType);
    event SensorUpdaterChanged(uint256 indexed projectId, bytes32 indexed sensorId, address updater);
    event AlertTriggered(uint256 indexed projectId, string alertType, string message);

    // Custom errors
    error ProjectNotFound();
    error ProjectNotActive();
    error InvalidSensor();
    error UnauthorizedUpdater();
    error InvalidData();
    error SensorNotActive();

    constructor(address _projectRegistry) {
        projectRegistry = ProjectRegistry(_projectRegistry);
    }

    /**
     * @dev Register a new sensor for a project
     */
    function registerSensor(
        uint256 projectId,
        bytes32 sensorId,
        string calldata sensorType,
        address authorizedUpdater
    ) external onlyOwner {
        if (!_validateProject(projectId)) revert ProjectNotFound();
        if (authorizedUpdater == address(0)) revert InvalidData();

        sensors[projectId][sensorId] = Sensor({
            sensorType: sensorType,
            isActive: true,
            lastUpdate: block.timestamp,
            authorizedUpdater: authorizedUpdater
        });

        emit SensorRegistered(projectId, sensorId, sensorType);
    }

    /**
     * @dev Update production data for a project
     */
    function updateProductionData(
        uint256 projectId,
        bytes32 sensorId,
        uint256 energyProduced,
        uint256 peakPower,
        int256 temperature,
        uint256 irradiance
    ) external whenNotPaused {
        if (!_validateProject(projectId)) revert ProjectNotFound();
        
        Sensor storage sensor = sensors[projectId][sensorId];
        if (!sensor.isActive) revert SensorNotActive();
        if (msg.sender != sensor.authorizedUpdater) revert UnauthorizedUpdater();

        _validateProductionData(energyProduced, peakPower, temperature, irradiance);

        ProductionData memory data = ProductionData({
            timestamp: block.timestamp,
            energyProduced: energyProduced,
            peakPower: peakPower,
            temperature: temperature,
            irradiance: irradiance
        });

        productionHistory[projectId][block.timestamp] = data;
        latestProduction[projectId] = data;
        sensor.lastUpdate = block.timestamp;

        emit ProductionDataUpdated(projectId, block.timestamp, energyProduced);

        _checkAlerts(projectId, data);
    }

    /**
     * @dev Get production data for a specific timestamp
     */
    function getProductionData(uint256 projectId, uint256 timestamp) 
        external 
        view 
        returns (ProductionData memory) 
    {
        return productionHistory[projectId][timestamp];
    }

    /**
     * @dev Get latest production data for a project
     */
    function getLatestProductionData(uint256 projectId) 
        external 
        view 
        returns (ProductionData memory) 
    {
        return latestProduction[projectId];
    }

    /**
     * @dev Validate project exists and is active
     */
    function _validateProject(uint256 projectId) internal view returns (bool) {
        (
            ProjectRegistry.ProjectBase memory base,
            ,
        ) = projectRegistry.getProjectDetails(projectId);

        return base.status == ProjectRegistry.ProjectStatus.Active;
    }

    /**
     * @dev Validate production data values
     */
    function _validateProductionData(
        uint256 energyProduced,
        uint256 peakPower,
        int256 temperature,
        uint256 irradiance
    ) internal pure {
        if (peakPower > energyProduced) revert InvalidData();
        if (temperature < -5000 || temperature > 8000) revert InvalidData(); // -50°C to 80°C
        if (irradiance > 1500) revert InvalidData(); // Max 1500 W/m²
    }

    /**
     * @dev Check for alert conditions
     */
    function _checkAlerts(uint256 projectId, ProductionData memory data) internal {
        // Check for zero production during daylight
        if (data.irradiance > 200 && data.energyProduced == 0) {
            emit AlertTriggered(projectId, "ZERO_PRODUCTION", "No production despite sufficient irradiance");
        }

        // Check for high temperature
        if (data.temperature > 7000) { // > 70°C
            emit AlertTriggered(projectId, "HIGH_TEMPERATURE", "Panel temperature above safe threshold");
        }

        // Check for low efficiency
        uint256 expectedProduction = (data.irradiance * 100) / 1000; // Simple efficiency calculation
        if (data.peakPower < expectedProduction * 70 / 100) { // Below 70% of expected
            emit AlertTriggered(projectId, "LOW_EFFICIENCY", "Production efficiency below threshold");
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
} 