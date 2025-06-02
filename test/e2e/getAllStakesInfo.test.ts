import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch All Stakes Info", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getAllStakeInfos()", () => {
		it("fetch all stakes information of a user", async () => {
			const lockupName = "Lockup 002";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			// const staker = "5BQwQmwJGBkL4rVjPxbS8JofmEPG2gCPTvxFUwSWfkG8";
			const staker = "99Ecn3r3f4sjPXrgSdXHYfR1VaEvmkWqZQ3VBoecJHRo";
			// const staker = wallet.publicKey;
			const start = Date.now();
			const infos = await service.getAllStakesInfo(staker, lockup, { maxConcurrent: 2, minDelayMs: 400 });
			console.log("time elapsed: %d ms", Date.now() - start);
			console.log("stake infos:", infos);
		});
	});
});
