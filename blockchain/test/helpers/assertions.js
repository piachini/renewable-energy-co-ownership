const { expect } = require("chai");

async function expectEmit(tx, eventName) {
    const receipt = await tx.wait();
    const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === eventName
    );
    expect(event).to.not.be.undefined;
    return event;
}

async function expectRevertWithError(promise, errorName) {
    try {
        await promise;
        expect.fail("Expected transaction to revert");
    } catch (error) {
        if (error.message.includes("Expected transaction to revert")) {
            throw error;
        }
        
        // Check for custom error in different locations
        const hasError = 
            error.message.includes(errorName) ||
            (error.data && error.data.message && error.data.message.includes(errorName)) ||
            (error.shortMessage && error.shortMessage.includes(errorName)) ||
            (error.revert && error.revert.name === errorName) ||
            (error.code === "CALL_EXCEPTION" && error.reason && error.reason.includes(errorName));

        expect(hasError, `Expected error "${errorName}" but got: ${error.message}`).to.be.true;
    }
}

function compareBigNumber(actual, expected) {
    return actual.toString() === expected.toString();
}

module.exports = {
    expectEmit,
    expectRevertWithError,
    compareBigNumber
}; 