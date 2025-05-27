import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress, deriveStakeAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch Stake Info", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getStakeInfo()", () => {
		it("fetch stake information of a user", async () => {
			const nonce = 0n;
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			const stake = deriveStakeAddress(wallet.publicKey, lockup, nonce, service.program.programId);
			const info = await service.getStakeInfo(stake, lockup);

			console.log("stake info:", info);
		});
	});
});
