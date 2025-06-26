import assert from "assert";

import { Program } from "@coral-xyz/anchor";

import { StakeService, StakeServiceBuilder, ZEBEC_STAKE_IDL_V1 } from "../../src";
import { createAnchorProvider, createReadonlyProvider } from "../../src/providers";
import { getConnection, getWallets } from "../shared";

const network = "devnet";
const connection = getConnection("devnet", "confirmed");
const wallets = getWallets(network);
const wallet = wallets[0];

describe("Stake service builder test", () => {
	it("should be created with default values", () => {
		try {
			const service = new StakeServiceBuilder().setNetwork().setProvider().setProgram().build();

			assert(service instanceof StakeService, "Service is not instance of StakeService");
		} catch (error) {
			// console.error("Error in stake service builder test:", error);
			assert.fail("Failed to build stake service: " + error.message);
		}
	});

	it("should create stake service with readonly provider", () => {
		try {
			const service = new StakeServiceBuilder()
				.setNetwork(network)
				.setProvider(createReadonlyProvider(connection, wallet.publicKey))
				.setProgram((provider) => new Program(ZEBEC_STAKE_IDL_V1, provider))
				.build();

			assert(service instanceof StakeService, "Service is not instance of StakeService");
		} catch (error) {
			// console.error("Error in stake service builder test:", error);
			assert.fail("Failed to build stake service: " + error.message);
		}
	});

	it("should create stake service with anchor provider", () => {
		try {
			const service = new StakeServiceBuilder()
				.setNetwork(network)
				.setProvider(createAnchorProvider(connection, wallet, { commitment: "confirmed" }))
				.setProgram((provider) => new Program(ZEBEC_STAKE_IDL_V1, provider))
				.build();

			assert(service instanceof StakeService, "Service is not instance of StakeService");
		} catch (error) {
			// console.error("Error in stake service builder test:", error);
			assert.fail("Failed to build stake service: " + error.message);
		}
	});

	it("should throw error when network is set twice", () => {
		try {
			new StakeServiceBuilder()
				.setNetwork(network)
				.setNetwork(network) // Setting network twice
				.setProvider(createReadonlyProvider(connection, wallet.publicKey))
				.setProgram()
				.build();

			assert.fail("Expected error not thrown");
		} catch (error) {
			assert(error instanceof Error, "Error is not instance of Error");
			assert.strictEqual(error.message, "InvalidOperation: Network is set twice.");
		}
	});

	it("should throw error when provider is set twice", () => {
		try {
			new StakeServiceBuilder()
				.setNetwork(network)
				.setProvider(createReadonlyProvider(connection, wallet.publicKey))
				.setProvider(createAnchorProvider(connection, wallet, { commitment: "confirmed" })) // Setting provider twice
				.setProgram()
				.build();

			assert.fail("Expected error not thrown");
		} catch (error) {
			assert(error instanceof Error, "Error is not instance of Error");
			assert.strictEqual(error.message, "InvalidOperation: Provider is set twice.");
		}
	});

	it("should throw error when program is set twice", () => {
		try {
			new StakeServiceBuilder()
				.setNetwork()
				.setProvider()
				.setProgram((provider) => new Program(ZEBEC_STAKE_IDL_V1, provider))
				.setProgram()
				.build();

			assert.fail("Expected error not thrown");
		} catch (error) {
			assert(error instanceof Error, "Error is not instance of Error");
			assert.strictEqual(error.message, "InvalidOperation: Program is set twice.");
		}
	});
});
