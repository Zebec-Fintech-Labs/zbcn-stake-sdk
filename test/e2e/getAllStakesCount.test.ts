import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch All Stakes Info", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getAllStakeInfos()", () => {
		it("fetch all stakes information of a user", async () => {
			const lockupName = "Lockup 002";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			const start = Date.now();
			const count = await service.getAllStakesCount(lockup);
			console.log("stakes count:", count);
			console.log("time elapsed: %d ms", Date.now() - start);
		});
	});
});
