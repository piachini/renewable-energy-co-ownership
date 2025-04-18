const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevertWithError } = require("./helpers/assertions");

describe("Monitoring", function () {
    let monitoring;
    let projectRegistry;
    let owner;
    let projectOwner;
    let sensorUpdater;
    let other;
    let assetToken;
    
    const PROJECT_ID = 0n;
    const SENSOR_ID = ethers.id("SENSOR_1"); // Creiamo un ID univoco per il sensore
    const SENSOR_TYPE = "SOLAR_PANEL";
    const PROJECT_NAME = "Impianto Solare Test";
    const PROJECT_DESCRIPTION = "Impianto fotovoltaico di test";
    const TARGET_AMOUNT = ethers.parseEther("1000");
    const MIN_INVESTMENT = ethers.parseEther("0.1");
    const MAX_INVESTMENT = ethers.parseEther("10");
    const POWER = 500000n; // 500 kW
    const TEMPERATURE = 2500n; // 25.00 °C
    const IRRADIANCE = 1000n; // 1000 W/m²
    const ALERT_THRESHOLD = 100n; // 100 W
    
    beforeEach(async function () {
        [owner, projectOwner, sensorUpdater, other] = await ethers.getSigners();
        
        // Deploy AssetToken
        const AssetToken = await ethers.getContractFactory("AssetToken");
        assetToken = await AssetToken.deploy("Test Token", "TEST");
        await assetToken.waitForDeployment();
        
        // Deploy ProjectRegistry
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();
        
        // Deploy Monitoring
        const Monitoring = await ethers.getContractFactory("Monitoring");
        monitoring = await Monitoring.deploy(await projectRegistry.getAddress());
        await monitoring.waitForDeployment();
        
        // Register project
        await projectRegistry.connect(projectOwner).registerProject(
            PROJECT_NAME,
            PROJECT_DESCRIPTION,
            TARGET_AMOUNT,
            MIN_INVESTMENT,
            MAX_INVESTMENT,
            await assetToken.getAddress()
        );
        
        // Set project status to Active
        await projectRegistry.connect(projectOwner).updateProjectStatus(0, 1);
    });
    
    describe("Inizializzazione", function () {
        it("dovrebbe impostare correttamente l'indirizzo del ProjectRegistry", async function () {
            expect(await monitoring.projectRegistry()).to.equal(await projectRegistry.getAddress());
        });
    });
    
    describe("Gestione Sensori", function () {
        it("dovrebbe registrare un nuovo sensore", async function () {
            await monitoring.registerSensor(
                PROJECT_ID,
                SENSOR_ID,
                SENSOR_TYPE,
                await sensorUpdater.getAddress()
            );
            
            const sensor = await monitoring.sensors(PROJECT_ID, SENSOR_ID);
            expect(sensor.sensorType).to.equal(SENSOR_TYPE);
            expect(sensor.authorizedUpdater).to.equal(await sensorUpdater.getAddress());
            expect(sensor.isActive).to.be.true;
        });
        
        it("dovrebbe fallire se il progetto non esiste", async function () {
            await expectRevertWithError(
                monitoring.registerSensor(
                    999n,
                    SENSOR_ID,
                    SENSOR_TYPE,
                    await sensorUpdater.getAddress()
                ),
                "ProjectDoesNotExist"
            );
        });
        
        it("dovrebbe fallire se chiamato da non owner", async function () {
            await expectRevertWithError(
                monitoring.connect(other).registerSensor(
                    PROJECT_ID,
                    SENSOR_ID,
                    SENSOR_TYPE,
                    await sensorUpdater.getAddress()
                ),
                "Ownable: caller is not the owner"
            );
        });
    });
    
    describe("Aggiornamento Dati Produzione", function () {
        beforeEach(async function () {
            await monitoring.registerSensor(
                PROJECT_ID,
                SENSOR_ID,
                SENSOR_TYPE,
                await sensorUpdater.getAddress()
            );
        });
        
        it("dovrebbe aggiornare i dati di produzione", async function () {
            await monitoring.connect(sensorUpdater).updateProductionData(
                PROJECT_ID,
                SENSOR_ID,
                POWER,
                POWER,  // peakPower
                TEMPERATURE,
                IRRADIANCE
            );
            
            const data = await monitoring.getLatestProductionData(PROJECT_ID);
            expect(data.energyProduced).to.equal(POWER);
            expect(data.peakPower).to.equal(POWER);
            expect(data.temperature).to.equal(TEMPERATURE);
            expect(data.irradiance).to.equal(IRRADIANCE);
        });
        
        it("dovrebbe fallire se chiamato da un sensore non autorizzato", async function () {
            await expectRevertWithError(
                monitoring.connect(other).updateProductionData(
                    PROJECT_ID,
                    SENSOR_ID,
                    POWER,
                    POWER,  // peakPower
                    TEMPERATURE,
                    IRRADIANCE
                ),
                "UnauthorizedUpdater"
            );
        });
    });
    
    describe("Sistema di Allerta", function () {
        beforeEach(async function () {
            await monitoring.registerSensor(
                PROJECT_ID,
                SENSOR_ID,
                SENSOR_TYPE,
                await sensorUpdater.getAddress()
            );
        });
        
        it("dovrebbe emettere un alert per produzione zero", async function () {
            const tx = await monitoring.connect(sensorUpdater).updateProductionData(
                PROJECT_ID,
                SENSOR_ID,
                0n,
                0n,  // peakPower
                TEMPERATURE,
                1000n  // Alta irradianza per triggerare l'alert
            );
            
            await expect(tx)
                .to.emit(monitoring, "AlertTriggered")
                .withArgs(PROJECT_ID, "ZERO_PRODUCTION", "No production despite sufficient irradiance");
        });
        
        it("dovrebbe emettere un alert per temperatura alta", async function () {
            const tx = await monitoring.connect(sensorUpdater).updateProductionData(
                PROJECT_ID,
                SENSOR_ID,
                POWER,
                POWER,  // peakPower
                8000n,  // 80.00 °C - Temperatura molto alta
                IRRADIANCE
            );
            
            await expect(tx)
                .to.emit(monitoring, "AlertTriggered")
                .withArgs(PROJECT_ID, "HIGH_TEMPERATURE", "Panel temperature above safe threshold");
        });
    });
    
    describe("Funzionalità di Pausa", function () {
        it("dovrebbe permettere la pausa e la ripresa", async function () {
            await monitoring.pause();
            expect(await monitoring.paused()).to.be.true;
            
            await monitoring.unpause();
            expect(await monitoring.paused()).to.be.false;
        });
        
        it("dovrebbe impedire aggiornamenti durante la pausa", async function () {
            await monitoring.registerSensor(
                PROJECT_ID,
                SENSOR_ID,
                SENSOR_TYPE,
                await sensorUpdater.getAddress()
            );
            await monitoring.pause();
            
            await expectRevertWithError(
                monitoring.connect(sensorUpdater).updateProductionData(
                    PROJECT_ID,
                    SENSOR_ID,
                    POWER,
                    POWER,  // peakPower
                    TEMPERATURE,
                    IRRADIANCE
                ),
                "Pausable: paused"
            );
        });
    });
}); 