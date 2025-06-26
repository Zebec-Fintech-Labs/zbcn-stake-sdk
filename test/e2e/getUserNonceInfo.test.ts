import assert from "assert";

import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress, deriveUserNonceAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch User Nonce Info", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getUserNonceInfo()", () => {
		it("fetch stake information of a user", async () => {
			const lockupName = "Lockup 002";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			const userNonce = deriveUserNonceAddress(wallet.publicKey, lockup, service.program.programId);
			const info = await service.getUserNonceInfo(userNonce);

			if (info) {
				assert("address" in info);
				assert("nonce" in info);
				assert.strictEqual(userNonce.toString(), info.address, "UserNonceAddress does not match");
			}

			console.log("user nonce info:", info);
		});
	});
});
