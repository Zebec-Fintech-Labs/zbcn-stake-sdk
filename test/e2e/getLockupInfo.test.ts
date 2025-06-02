import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import { deriveLockupAddress } from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch Lockup Info", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[1];
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("getLockupInfo()", () => {
		it("fetch lockup information", async () => {
			const lockupName = "Lockup 002";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			console.log("lockup address:", lockup.toString());
			const info = await service.getLockupInfo(lockup);

			console.log("lockup info:", JSON.stringify(info, null, 2));
		});
	});
});
