import { BN, Program } from "@coral-xyz/anchor";

import { createAnchorProvider, TEN_BIGNUM, ZEBEC_STAKE_IDL_V1, ZebecStakeIdlV1 } from "../../src";
import { getConnection, getWallets } from "../shared";

describe("Whitelist Stakers", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });
	const program = new Program<ZebecStakeIdlV1>(ZEBEC_STAKE_IDL_V1, provider);

	describe("whitelistStaker()", () => {
		it("whitelist stakers", async () => {
			const stakeToken = "";
			const lockup = "";
			const staker = "";
			const stakeTokenDecimals = 6;
			const amount = new BN(BigNumber(1).times(TEN_BIGNUM.pow(stakeTokenDecimals)).toFixed(0));
			const createdTime = new BN(Math.floor(Date.now() / 1000));
			const lockPeriod = new BN(60 * 60 * 1);
			const nonce = new BN(1);

			const signature = await program.methods
				.whitelistStaker({
					amount,
					createdTime,
					lockPeriod,
					nonce,
				})
				.accounts({
					lockup,
					staker,
					stakeToken,
				})
				.signers([wallet.payer])
				.rpc();

			console.log("signature:", signature);
		});
	});
});
