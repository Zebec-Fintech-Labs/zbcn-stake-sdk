import assert from "node:assert";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@zebec-network/solana-common";
import { describe, it } from "mocha";

import { createReadonlyProvider, StakeServiceBuilder } from "../../src";
import {
	deriveLockupAddress,
	deriveRewardVaultAddress,
	deriveStakeVaultAddress,
} from "../../src/pda";
import { getConnection, getWallets } from "../shared";

describe("Fetch Lockup Info", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("wallet:", wallet.publicKey.toString());
	const provider = createReadonlyProvider(connection, wallet.publicKey);

	const service = new StakeServiceBuilder()
		.setNetwork(network)
		.setProvider(provider)
		.setProgram()
		.build();

	describe("getLockupInfo()", () => {
		it("fetch lockup information", async () => {
			// const lockupName = "ZBCN_Lockup_003";
			// const lockupName = "ZBCN_Lockup_UAT_001"; // mainnet-beta | uat
			// const lockupName = "ZBCN_Lockup_002";
			const lockupName = "Lockup_004"; // devnet
			const lockup = deriveLockupAddress(lockupName, service.program.programId);
			console.log("lockup address:", lockup.toString());

			const stakeVault = deriveStakeVaultAddress(lockup, service.programId);
			console.log("stake vault address:", stakeVault.toString());

			const rewardVault = deriveRewardVaultAddress(lockup, service.programId);
			console.log("reward vault address:", rewardVault.toString());

			const info = await service.getLockupInfo(lockup);
			assert(info, "Failed to fetch lockup info");
			console.log("lockup info:", JSON.stringify(info, null, 2));

			const stakeToken = info.stakeToken.tokenAdress;
			const rewardToken = info.rewardToken.tokenAddress;

			const stakeVaultTokenAccount = getAssociatedTokenAddressSync(
				new PublicKey(stakeToken),
				stakeVault,
				true,
			);
			console.log("stakeVaultTokenAccount:", stakeVaultTokenAccount.toString());
			const rewardVaultTokenAccount = getAssociatedTokenAddressSync(
				new PublicKey(rewardToken),
				rewardVault,
				true,
			);
			console.log(
				"rewardVaultTokenAccount:",
				rewardVaultTokenAccount.toString(),
			);

			const feeVault = info.feeInfo.feeVault;
			console.log("fee vault address:", feeVault);
			const feeVaultTokenAccount = getAssociatedTokenAddressSync(
				new PublicKey(stakeToken),
				new PublicKey(feeVault),
				true,
			);
			console.log("feeVaultTokenAccount:", feeVaultTokenAccount.toString());
		});
	});
});
