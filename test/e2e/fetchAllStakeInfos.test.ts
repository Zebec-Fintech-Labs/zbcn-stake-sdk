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
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);

			const infos = await service.getAllStakeInfos(wallet.publicKey, lockup);

			console.log("stake infos:", infos);
		});
	});
});
