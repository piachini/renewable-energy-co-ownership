const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevertWithError } = require("./helpers/assertions");

const DATA_PACKET_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes("DataPacket(bytes32 deviceId,uint256 timestamp,bytes encryptedData)")
);

describe("IoT", function () {
    let iot;
    let monitoring;
    let projectRegistry;
    let owner;
    let deviceOperator;
    let other;
    
    const PROJECT_ID = 0n;
    const DEVICE_ID = ethers.id("DEVICE_1");
    const MQTT_PROTOCOL = "MQTT";
    const ENDPOINT = "mqtt://device1.energy-platform.com";
    const UPDATE_INTERVAL = 300n; // 5 minutes
    const DEVICE_PRIVATE_KEY = "0x1234567890123456789012345678901234567890123456789012345678901234";
    const deviceSigner = new ethers.Wallet(DEVICE_PRIVATE_KEY);
    
    async function createTestPacket(deviceId, timestamp, data, deviceSigner) {
        // Convert data to bytes
        const encryptedData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "uint256"],
            [data.power, data.temperature, data.irradiance]
        );

        // Pack the message according to EIP-712
        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "bytes32", "uint256", "bytes"],
                [
                    DATA_PACKET_TYPEHASH,
                    deviceId,
                    timestamp,
                    encryptedData
                ]
            )
        );

        // Get the domain separator from the contract
        const domainSeparator = await iot.getDomainSeparator();

        // Create the final hash
        const finalHash = ethers.keccak256(
            ethers.concat([
                ethers.toUtf8Bytes("\x19\x01"),
                ethers.getBytes(domainSeparator),
                ethers.getBytes(messageHash)
            ])
        );

        // Sign the final hash
        const signingKey = new ethers.SigningKey(deviceSigner.privateKey);
        const signature = signingKey.sign(finalHash).serialized;

        return {
            deviceId,
            timestamp,
            signature,
            encryptedData
        };
    }
    
    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        
        // Deploy AssetToken
        const AssetToken = await ethers.getContractFactory("AssetToken");
        const assetToken = await AssetToken.deploy("Test Token", "TEST");
        await assetToken.waitForDeployment();
        
        // Deploy ProjectRegistry
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();
        
        // Deploy Monitoring
        const Monitoring = await ethers.getContractFactory("Monitoring");
        monitoring = await Monitoring.deploy(await projectRegistry.getAddress());
        await monitoring.waitForDeployment();
        
        // Deploy IoT
        const IoT = await ethers.getContractFactory("IoT");
        iot = await IoT.deploy(await monitoring.getAddress());
        await iot.waitForDeployment();
        
        // Register project and set it as active
        await projectRegistry.registerProject(
            "Test Project",
            "Test Description",
            ethers.parseEther("1000"), // targetAmount
            ethers.parseEther("0.1"),  // minInvestment
            ethers.parseEther("10"),   // maxInvestment
            await assetToken.getAddress()  // Use actual token address
        );
        await projectRegistry.updateProjectStatus(PROJECT_ID, 1); // Set to Active
    });
    
    describe("Initialization", function () {
        it("should set the correct Monitoring contract address", async function () {
            expect(await iot.monitoring()).to.equal(await monitoring.getAddress());
        });
    });
    
    describe("Device Registration", function () {
        it("should register a new device", async function () {
            const secretHash = ethers.id("secret");
            
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                secretHash,
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
            
            const device = await iot.devices(DEVICE_ID);
            expect(device.protocol).to.equal(MQTT_PROTOCOL);
            expect(device.endpoint).to.equal(ENDPOINT);
            expect(device.secretHash).to.equal(secretHash);
            expect(device.isActive).to.be.true;
            expect(device.updateInterval).to.equal(UPDATE_INTERVAL);
        });
        
        it("should fail with invalid protocol", async function () {
            await expectRevertWithError(
                iot.registerDevice(
                    DEVICE_ID,
                    PROJECT_ID,
                    "INVALID",
                    ENDPOINT,
                    ethers.id("secret"),
                    UPDATE_INTERVAL,
                    await deviceSigner.getAddress()
                ),
                "InvalidProtocol"
            );
        });
        
        it("should fail with empty endpoint", async function () {
            await expectRevertWithError(
                iot.registerDevice(
                    DEVICE_ID,
                    PROJECT_ID,
                    MQTT_PROTOCOL,
                    "",
                    ethers.id("secret"),
                    UPDATE_INTERVAL,
                    await deviceSigner.getAddress()
                ),
                "InvalidEndpoint"
            );
        });
        
        it("should fail if device already registered", async function () {
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                ethers.id("secret"),
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
            
            await expectRevertWithError(
                iot.registerDevice(
                    DEVICE_ID,
                    PROJECT_ID,
                    MQTT_PROTOCOL,
                    ENDPOINT,
                    ethers.id("secret"),
                    UPDATE_INTERVAL,
                    await deviceSigner.getAddress()
                ),
                "DeviceAlreadyRegistered"
            );
        });
    });
    
    describe("Data Reception", function () {
        let currentTimestamp;

        beforeEach(async function () {
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                ethers.id("secret"),
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
            
            // Register and activate sensor in monitoring contract
            await monitoring.registerSensor(
                PROJECT_ID,
                DEVICE_ID,
                "SOLAR",
                await iot.getAddress()
            );

            // Get current block timestamp
            const block = await ethers.provider.getBlock('latest');
            currentTimestamp = BigInt(block.timestamp);
        });
        
        it("should receive and process valid data", async function () {
            const data = {
                power: 500000n,      // 500 kW
                temperature: 2500n,   // 25.00 °C
                irradiance: 1000n     // 1000 W/m²
            };
            
            const packet = await createTestPacket(DEVICE_ID, currentTimestamp, data, deviceSigner);
            
            await expect(iot.receiveData(
                packet.deviceId,
                packet.timestamp,
                packet.signature,
                packet.encryptedData
            ))
                .to.emit(iot, "DataReceived")
                .withArgs(packet.deviceId, packet.timestamp);
        });
        
        it("should fail with invalid device", async function () {
            const data = {
                power: 500000n,
                temperature: 2500n,
                irradiance: 1000n
            };
            
            const packet = await createTestPacket(ethers.id("INVALID_DEVICE"), currentTimestamp, data, deviceSigner);
            await expectRevertWithError(
                iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    packet.signature,
                    packet.encryptedData
                ),
                "DeviceNotFound"
            );
        });
        
        it("should fail with inactive device", async function () {
            await iot.deactivateDevice(DEVICE_ID);
            
            const data = {
                power: 500000n,
                temperature: 2500n,
                irradiance: 1000n
            };
            
            const packet = await createTestPacket(DEVICE_ID, currentTimestamp, data, deviceSigner);
            await expectRevertWithError(
                iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    packet.signature,
                    packet.encryptedData
                ),
                "DeviceNotActive"
            );
        });
        
        it("should fail with invalid signature", async function () {
            const data = {
                power: 500000n,
                temperature: 2500n,
                irradiance: 1000n
            };
            
            const packet = await createTestPacket(DEVICE_ID, currentTimestamp, data, deviceSigner);
            // Modify the signature to make it invalid by changing the last byte
            const signatureBytes = ethers.getBytes(packet.signature);
            signatureBytes[signatureBytes.length - 1] = (signatureBytes[signatureBytes.length - 1] + 1) % 256;
            const invalidSignature = ethers.hexlify(signatureBytes);
            
            await expectRevertWithError(
                iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    invalidSignature,
                    packet.encryptedData
                ),
                "InvalidSignature"
            );
        });
        
        it("should fail with old data", async function () {
            const oldTimestamp = currentTimestamp - 3600n; // 1 hour ago
            const data = {
                power: 500000n,
                temperature: 2500n,
                irradiance: 1000n
            };
            
            const packet = await createTestPacket(DEVICE_ID, oldTimestamp, data, deviceSigner);
            await expectRevertWithError(
                iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    packet.signature,
                    packet.encryptedData
                ),
                "DataTooOld"
            );
        });
    });
    
    describe("Device Management", function () {
        beforeEach(async function () {
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                ethers.id("secret"),
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
        });
        
        it("should deactivate a device", async function () {
            await iot.deactivateDevice(DEVICE_ID);
            const device = await iot.devices(DEVICE_ID);
            expect(device.isActive).to.be.false;
        });
        
        it("should fail to deactivate non-existent device", async function () {
            await expectRevertWithError(
                iot.deactivateDevice(ethers.id("INVALID_DEVICE")),
                "DeviceNotFound"
            );
        });
    });
    
    describe("Pause Functionality", function () {
        let currentTimestamp;

        beforeEach(async function () {
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                ethers.id("secret"),
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
            
            const block = await ethers.provider.getBlock('latest');
            currentTimestamp = BigInt(block.timestamp);
        });

        it("should prevent data reception when paused", async function () {
            await iot.pause();
            
            const data = {
                power: 500000n,
                temperature: 2500n,
                irradiance: 1000n
            };
            
            const packet = await createTestPacket(DEVICE_ID, currentTimestamp, data, deviceSigner);
            await expectRevertWithError(
                iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    packet.signature,
                    packet.encryptedData
                ),
                "Pausable: paused"
            );
        });
    });

    describe("Data Management", function () {
        let currentTimestamp;
        const DATA_POINTS = 5;

        beforeEach(async function () {
            await iot.registerDevice(
                DEVICE_ID,
                PROJECT_ID,
                MQTT_PROTOCOL,
                ENDPOINT,
                ethers.id("secret"),
                UPDATE_INTERVAL,
                await deviceSigner.getAddress()
            );
            
            const block = await ethers.provider.getBlock('latest');
            currentTimestamp = BigInt(block.timestamp);

            // Register and activate sensor in monitoring contract
            await monitoring.registerSensor(
                PROJECT_ID,
                DEVICE_ID,
                "SOLAR",
                await iot.getAddress()
            );

            // Send multiple data points
            for (let i = 0; i < DATA_POINTS; i++) {
                const data = {
                    power: 500000n + BigInt(i * 10000),
                    temperature: 2500n + BigInt(i * 10),
                    irradiance: 1000n + BigInt(i * 50)
                };
                
                const packet = await createTestPacket(DEVICE_ID, currentTimestamp + BigInt(i * 60), data, deviceSigner);
                await iot.receiveData(
                    packet.deviceId,
                    packet.timestamp,
                    packet.signature,
                    packet.encryptedData
                );
            }
        });

        it("should return correct data count", async function () {
            const count = await iot.getDataCount(DEVICE_ID);
            expect(count).to.equal(DATA_POINTS);
        });

        it("should return empty array for non-existent device", async function () {
            const count = await iot.getDataCount(ethers.id("NON_EXISTENT"));
            expect(count).to.equal(0);
        });

        it("should return data within time range", async function () {
            const startTime = currentTimestamp;
            const endTime = currentTimestamp + BigInt(120); // 2 minutes range
            
            const dataInRange = await iot.getDataInRange(DEVICE_ID, startTime, endTime);
            expect(dataInRange.length).to.equal(3); // Should include first 3 data points
        });

        it("should return empty array for invalid time range", async function () {
            const futureTime = currentTimestamp + BigInt(3600); // 1 hour in future
            const dataInRange = await iot.getDataInRange(DEVICE_ID, futureTime, futureTime + BigInt(60));
            expect(dataInRange.length).to.equal(0);
        });

        it("should clean old data", async function () {
            // Move time forward by 31 days
            await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");
            
            // Clean old data
            await iot.cleanOldData(DEVICE_ID);
            
            const count = await iot.getDataCount(DEVICE_ID);
            expect(count).to.equal(0);
        });

        it("should not clean recent data", async function () {
            // Clean data
            await iot.cleanOldData(DEVICE_ID);
            
            const count = await iot.getDataCount(DEVICE_ID);
            expect(count).to.equal(DATA_POINTS);
        });

        it("should emit DataCleaned event when cleaning data", async function () {
            // Move time forward by 31 days
            await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");
            
            // Clean old data and check event
            await expect(iot.cleanOldData(DEVICE_ID))
                .to.emit(iot, "DataCleaned")
                .withArgs(DEVICE_ID, DATA_POINTS);
        });

        it("should not allow non-owner to clean data", async function () {
            await expectRevertWithError(
                iot.connect(other).cleanOldData(DEVICE_ID),
                "Ownable: caller is not the owner"
            );
        });
    });
}); 