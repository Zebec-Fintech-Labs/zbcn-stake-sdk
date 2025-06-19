import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch All Stakes Info", () => {
	const network = "mainnet-beta";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getAllStakeInfos()", () => {
		it("fetch all stakes information of a user", async () => {
			const lockupName = "ZBCN Lockup";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			// const staker = "5BQwQmwJGBkL4rVjPxbS8JofmEPG2gCPTvxFUwSWfkG8";
			// const staker = "99Ecn3r3f4sjPXrgSdXHYfR1VaEvmkWqZQ3VBoecJHRo";
			// const staker = "Hnik4HYi7G7gsk72QFgJRK5aGRYzDcV79VuEGE8uz88R";
			const staker = "7TRtTTBfG65LRxzFgRWFDdkcxjjryP6QLPFub3SuGbFu";
			// const staker = wallet.publicKey;
			const start = Date.now();
			const infos = await service.getAllStakesInfoOfUser(staker, lockup, { maxConcurrent: 4, minDelayMs: 100 });
			console.log("stake infos:", infos);
			console.log("time elapsed: %d ms", Date.now() - start);
		});
	});
});
