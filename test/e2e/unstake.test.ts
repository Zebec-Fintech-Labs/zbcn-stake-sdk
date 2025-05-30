import { StakeServiceBuilder } from "../../src";
import { createAnchorProvider } from "../../src/providers";
import { getConnection, getWallets } from "../shared";

describe("Unstake", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("unstake()", () => {
		it("transfer token to lockup for staking", async () => {
			const nonce = 0n;
			const lockupName = "Lockup 001";

			const payload = await service.unstake({
				nonce,
				lockupName,
			});

			const signature = await payload.execute();

			console.log("signature:", signature);
		});
	});
});
