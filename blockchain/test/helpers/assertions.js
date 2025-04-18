const { expect } = require("chai");

async function expectEmit(tx, eventName) {
  const receipt = await tx.wait();
  expect(receipt.events.some(e => e.event === eventName)).to.be.true;
  return receipt.events.find(e => e.event === eventName);
}

async function expectRevertWithError(promise, errorName) {
  try {
    await promise;
    expect.fail("Expected transaction to revert");
  } catch (error) {
    if (error.message.includes("Expected transaction to revert")) {
      throw error;
    }
    expect(
      error.message.includes(errorName) || 
      (error.data && error.data.message && error.data.message.includes(errorName)) ||
      (error.shortMessage && error.shortMessage.includes(errorName))
    ).to.be.true;
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