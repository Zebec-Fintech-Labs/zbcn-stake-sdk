import { StakeServiceBuilder } from "../../src";
import { deriveLockupAddress, deriveUserNonceAddress } from "../../src/pda";
import { createAnchorProvider } from "../../src/providers";
import { getConnection, getWallets } from "../shared";

describe("Stake", () => {
	const network = "devnet";
	const connection = getConnection("devnet");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("stake()", () => {
		it("transfer token to lockup for staking", async () => {
			const amount = 100;
			const lockPeriod = 120; // sec
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			const userNonceAddress = deriveUserNonceAddress(wallet.publicKey, lockup, service.program.programId);
			const nonceInfo = await service.getUserNonceInfo(userNonceAddress);
			const nonce = nonceInfo ? nonceInfo.nonce : 0n;
			console.log("Nonce:", nonce);

			const payload = await service.stake({
				amount,
				lockPeriod,
				nonce,
				lockupName,
			});

			const signature = await payload.execute();

			console.log("signature:", signature);
		});
	});
});
