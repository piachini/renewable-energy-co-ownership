// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./Monitoring.sol";

/**
 * @title IoT
 * @dev Contract for managing IoT device integration and data validation
 */
contract IoT is Ownable, Pausable {
    struct Device {
        bytes32 deviceId;
        string protocol;     // "MQTT" or "CoAP"
        string endpoint;     // Device endpoint URL/topic
        bytes32 secretHash;  // Hash of the device secret
        bool isActive;
        uint256 lastPing;
        uint256 updateInterval;
        address signer;      // Address that can sign messages for this device
    }

    struct DataPacket {
        bytes32 deviceId;
        uint256 timestamp;
        bytes encryptedData;
    }

    // Device ID => Device
    mapping(bytes32 => Device) public devices;
    
    // Device ID => Project ID
    mapping(bytes32 => uint256) public deviceProjects;
    
    // Project ID => Device IDs
    mapping(uint256 => bytes32[]) public projectDevices;

    // Device ID => Data Packets
    mapping(bytes32 => DataPacket[]) public deviceData;

    Monitoring public monitoring;

    // Constants
    uint256 public constant MAX_STORED_DATA = 1000; // Maximum number of data points per device
    uint256 public constant DATA_RETENTION_PERIOD = 30 days; // How long to keep data

    // Events
    event DeviceRegistered(bytes32 indexed deviceId, uint256 indexed projectId, string protocol);
    event DeviceDeactivated(bytes32 indexed deviceId);
    event DataReceived(bytes32 indexed deviceId, uint256 timestamp);
    event DataValidationFailed(bytes32 indexed deviceId, string reason);
    event DevicePinged(bytes32 indexed deviceId, uint256 timestamp);
    event DataCleaned(bytes32 indexed deviceId, uint256 count);
    
    // Debug events
    event Debug_MessageHash(bytes32 messageHash);
    event Debug_EthSignedMessageHash(bytes32 ethSignedMessageHash);
    event Debug_SignatureComponents(bytes32 r, bytes32 s, uint8 v);
    event Debug_Signer(address signer, address expectedSigner);
    event Debug_RawMessage(bytes32 deviceId, uint256 timestamp, bytes encryptedData);
    event Debug_PackedMessage(bytes packedMessage);
    event Debug_SignatureLength(uint256 length);

    // Custom errors
    error InvalidProtocol();
    error InvalidEndpoint();
    error InvalidUpdateInterval();
    error DeviceNotFound();
    error DeviceNotActive();
    error InvalidSignature();
    error InvalidData();
    error UnauthorizedDevice();
    error DeviceAlreadyRegistered();
    error DataTooOld();
    error InvalidTimestamp();
    error InvalidDataLength();

    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 private constant DATA_PACKET_TYPEHASH = keccak256(
        "DataPacket(bytes32 deviceId,uint256 timestamp,bytes encryptedData)"
    );

    bytes32 private immutable DOMAIN_SEPARATOR;

    /**
     * @dev Get the domain separator
     * @return bytes32 The domain separator
     */
    function getDomainSeparator() public view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }

    /**
     * @dev Constructor
     * @param _monitoring Address of the Monitoring contract
     */
    constructor(address _monitoring) {
        monitoring = Monitoring(_monitoring);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256("IoT"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Register a new IoT device
     * @param deviceId Unique identifier for the device
     * @param projectId Project ID the device belongs to
     * @param protocol Communication protocol (MQTT/CoAP)
     * @param endpoint Device endpoint
     * @param secretHash Hash of the device secret
     * @param updateInterval Minimum time between updates
     * @param signer Address of the device signer
     */
    function registerDevice(
        bytes32 deviceId,
        uint256 projectId,
        string calldata protocol,
        string calldata endpoint,
        bytes32 secretHash,
        uint256 updateInterval,
        address signer
    ) external onlyOwner {
        if (devices[deviceId].deviceId != bytes32(0)) revert DeviceAlreadyRegistered();
        if (!_isValidProtocol(protocol)) revert InvalidProtocol();
        if (bytes(endpoint).length == 0) revert InvalidEndpoint();
        if (updateInterval == 0) revert InvalidUpdateInterval();

        devices[deviceId] = Device({
            deviceId: deviceId,
            protocol: protocol,
            endpoint: endpoint,
            secretHash: secretHash,
            isActive: true,
            lastPing: block.timestamp,
            updateInterval: updateInterval,
            signer: signer
        });

        deviceProjects[deviceId] = projectId;
        projectDevices[projectId].push(deviceId);

        emit DeviceRegistered(deviceId, projectId, protocol);
    }

    /**
     * @dev Receive and validate data from IoT device
     * @param deviceId Unique identifier of the device
     * @param timestamp Timestamp of the data
     * @param signature Signature of the data packet
     * @param encryptedData Encrypted data from the device
     */
    function receiveData(
        bytes32 deviceId,
        uint256 timestamp,
        bytes calldata signature,
        bytes calldata encryptedData
    ) external whenNotPaused {
        Device storage device = devices[deviceId];
        if (device.deviceId == bytes32(0)) revert DeviceNotFound();
        if (!device.isActive) revert DeviceNotActive();
        
        // Check if data is too old using unchecked math to prevent overflow
        unchecked {
            if (block.timestamp > timestamp && block.timestamp - timestamp > device.updateInterval) {
                revert DataTooOld();
            }
        }

        if (!_validateSignature(deviceId, timestamp, signature, encryptedData)) {
            revert InvalidSignature();
        }

        // Store the data
        deviceData[deviceId].push(DataPacket({
            deviceId: deviceId,
            timestamp: timestamp,
            encryptedData: encryptedData
        }));

        emit DataReceived(deviceId, timestamp);
    }

    /**
     * @dev Deactivate a device
     * @param deviceId Unique identifier of the device
     */
    function deactivateDevice(bytes32 deviceId) external onlyOwner {
        Device storage device = devices[deviceId];
        if (device.deviceId == bytes32(0)) revert DeviceNotFound();
        
        device.isActive = false;
        emit DeviceDeactivated(deviceId);
    }

    /**
     * @dev Validate protocol string
     * @param protocol Protocol to validate
     * @return bool True if protocol is valid
     */
    function _isValidProtocol(string memory protocol) internal pure returns (bool) {
        bytes32 protocolHash = keccak256(bytes(protocol));
        return protocolHash == keccak256("MQTT") || protocolHash == keccak256("CoAP");
    }

    /**
     * @dev Validate data packet signature
     * @param deviceId Unique identifier of the device
     * @param timestamp Timestamp of the data
     * @param signature Signature of the data packet
     * @param encryptedData Encrypted data from the device
     * @return bool True if signature is valid
     */
    function _validateSignature(
        bytes32 deviceId,
        uint256 timestamp,
        bytes memory signature,
        bytes memory encryptedData
    ) internal view returns (bool) {
        if (signature.length != 65) return false;

        // Pack the message according to EIP-712
        bytes32 messageHash = keccak256(
            abi.encode(
                DATA_PACKET_TYPEHASH,
                deviceId,
                timestamp,
                encryptedData
            )
        );

        // Get the domain separator
        bytes32 domainSeparator = getDomainSeparator();

        // Create the final hash
        bytes32 finalHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                messageHash
            )
        );

        // Split the signature
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // Validate v value
        if (v != 27 && v != 28) return false;

        // Recover the signer using ECDSA.recover
        address signer = ECDSA.recover(finalHash, v, r, s);
        if (signer == address(0)) return false;

        // Get the device owner
        address deviceOwner = devices[deviceId].signer;

        // Verify the signer matches the device owner
        return signer == deviceOwner;
    }

    /**
     * @dev Convert uint to string
     */
    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    /**
     * @dev Validate data packet contents
     */
    function _validateData(DataPacket calldata packet) internal returns (bool) {
        // Ensure data is not empty
        if (packet.encryptedData.length == 0) {
            emit DataValidationFailed(packet.deviceId, "Empty data");
            return false;
        }
        
        // Ensure timestamp is reasonable
        if (packet.timestamp > block.timestamp) {
            emit DataValidationFailed(packet.deviceId, "Future timestamp");
            return false;
        }

        // Check if data is too old based on device's update interval
        Device storage device = devices[packet.deviceId];
        if (block.timestamp - packet.timestamp > device.updateInterval) {
            emit DataValidationFailed(packet.deviceId, "Data too old");
            return false;
        }

        return true;
    }

    /**
     * @dev Decrypt and process data packet
     * Returns (power, temperature, irradiance)
     */
    function _decryptAndProcessData() internal pure returns (
        uint256 power,
        uint256 temperature,
        uint256 irradiance
    ) {
        // Remove decryption logic since it's not implemented
        // Return default values
        return (0, 0, 0);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Clean old data for a device
     * @param deviceId Device identifier
     */
    function cleanOldData(bytes32 deviceId) external onlyOwner {
        DataPacket[] storage data = deviceData[deviceId];
        uint256 cutoffTime = block.timestamp - DATA_RETENTION_PERIOD;
        
        // Find the first index that should be kept
        uint256 keepIndex = 0;
        while (keepIndex < data.length && data[keepIndex].timestamp < cutoffTime) {
            keepIndex++;
        }
        
        // If we found data to remove
        if (keepIndex > 0) {
            // Shift the array
            for (uint256 i = 0; i < data.length - keepIndex; i++) {
                data[i] = data[i + keepIndex];
            }
            
            // Resize the array by popping elements
            for (uint256 i = 0; i < keepIndex; i++) {
                data.pop();
            }
            
            emit DataCleaned(deviceId, keepIndex);
        }
    }

    /**
     * @dev Get the number of data points for a device
     * @param deviceId Device identifier
     * @return uint256 Number of data points
     */
    function getDataCount(bytes32 deviceId) external view returns (uint256) {
        return deviceData[deviceId].length;
    }

    /**
     * @dev Get data points for a device within a time range
     * @param deviceId Device identifier
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return DataPacket[] Array of data points
     */
    function getDataInRange(
        bytes32 deviceId,
        uint256 startTime,
        uint256 endTime
    ) external view returns (DataPacket[] memory) {
        DataPacket[] storage allData = deviceData[deviceId];
        uint256 count = 0;
        
        // Count matching data points
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].timestamp >= startTime && allData[i].timestamp <= endTime) {
                count++;
            }
        }
        
        // Create and populate result array
        DataPacket[] memory result = new DataPacket[](count);
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allData.length; i++) {
            if (allData[i].timestamp >= startTime && allData[i].timestamp <= endTime) {
                result[resultIndex] = allData[i];
                resultIndex++;
            }
        }
        
        return result;
    }
} 