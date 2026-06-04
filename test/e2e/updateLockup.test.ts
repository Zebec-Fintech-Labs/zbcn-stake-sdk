import assert from "node:assert";
import { describe, it } from "mocha";

import {
	createAnchorProvider,
	deriveLockupAddress,
	type RewardScheme,
	StakeServiceBuilder,
} from "../../src";
import { getConnection, getWallets } from "../shared";

describe("Update Lockup", () => {
	const network = "devnet";
	const connection = getConnection(network, "confirmed");
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet, {
		commitment: "confirmed",
	});

	const service = new StakeServiceBuilder()
		.setNetwork(network)
		.setProvider(provider)
		.setProgram()
		.build();

	describe("update lockup()", () => {
		const lockupName: string = "Lockup_004";

		// before(async () => {
		// 	lockupName = `Lockup_${Date.now()}`;

		// 	const rewardToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
		// 	const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
		// 	const fee = 0;
		// 	const feeVault = "AA8B8zv68QCT8pkJL9vd6nAG9MzopARH9xvY1CLgAQQQ";
		// 	const rewardSchemes: RewardScheme[] = [
		// 		{
		// 			// duration: 2592000, // 30 days
		// 			duration: 30,
		// 			rewardRate: "8.00",
		// 		},
		// 		{
		// 			// duration: 7776000, // 90 days
		// 			duration: 90,
		// 			rewardRate: "12.00",
		// 		},
		// 		{
		// 			// duration: 10368000, // 120 days
		// 			duration: 120,
		// 			rewardRate: "15.00",
		// 		},
		// 	];
		// 	const minimumStake = 0.000001;

		// 	const payload = await service.initLockup({
		// 		rewardToken,
		// 		stakeToken,
		// 		fee,
		// 		feeVault,
		// 		name: lockupName,
		// 		rewardSchemes,
		// 		minimumStake,
		// 	});

		// 	const signature = await payload.execute({ commitment: "confirmed" });
		// 	console.log("signature:", signature);
		// });

		it("update staking lock", async () => {
			const fee = 0.0;
			const feeVault = "FLcSsn4xguvNYtnB7qSmh3yCPUcek6VBsfzWnhYSBAKT";
			const rewardSchemes: RewardScheme[] = [
				{
					// duration: 2592000, // 30 days
					duration: 30,
					rewardRate: "30.00",
				},
				{
					// duration: 7776000, // 90 days
					duration: 90,
					rewardRate: "50.00",
				},
				{
					// duration: 15552000, // 180 days
					duration: 180,
					rewardRate: "70.00",
				},
			];
			const minimumStake = 0.000001;

			const payload = await service.updateLockup({
				fee,
				feeVault,
				lockupName,
				rewardSchemes,
				minimumStake,
				updater: wallet.publicKey.toString(),
			});

			const signature = await payload.execute({ commitment: "confirmed" });
			console.log("signature:", signature);

			const transaction = await connection.getTransaction(signature, {
				commitment: "confirmed",
				maxSupportedTransactionVersion: 0,
			});
			assert(
				transaction,
				`Transaction does not exists for signature: ${signature}`,
			);

			const lockupAddress = deriveLockupAddress(lockupName, service.programId);
			const lockupInfo = await service.getLockupInfo(lockupAddress);

			assert(
				lockupInfo,
				`Lockup Info does not exists for name: ${lockupName}, lockup: ${lockupAddress.toString()}`,
			);
			assert.strictEqual(
				lockupInfo.address,
				lockupAddress.toString(),
				"Address does not match in lockup info",
			);
			assert.strictEqual(
				lockupInfo.feeInfo.fee,
				fee.toString(),
				"Fee does not match in lockup info",
			);
			assert.strictEqual(
				lockupInfo.feeInfo.feeVault,
				feeVault,
				"Fee does not match in lockup info",
			);
			assert.strictEqual(
				lockupInfo.stakeInfo.minimumStake,
				minimumStake.toString(),
				"Minimum stake does not match in lockup info",
			);
			assert.deepStrictEqual(
				lockupInfo.stakeInfo.rewardSchemes,
				rewardSchemes,
				"Reward Schemes does not match in lockup info",
			);
		});

		it.skip("fail to update staking lock by non-creator", async () => {
			const walletB = wallets[1];
			const providerB = createAnchorProvider(connection, walletB, {
				commitment: "confirmed",
			});
			const serviveB = new StakeServiceBuilder()
				.setNetwork(network)
				.setProvider(providerB)
				.setProgram()
				.build();

			const fee = 10;
			const feeVault = "CfMZHY1yJzKudnDvroLWCHHNuDTncN7xwJhpRdLijoiv";
			const rewardSchemes: RewardScheme[] = [
				{
					// duration: 2592000, // 30 days
					duration: 30,
					rewardRate: "3.00",
				},
				{
					// duration: 7776000, // 90 days
					duration: 90,
					rewardRate: "5.00",
				},
				{
					// duration: 15552000, // 180 days
					duration: 180,
					rewardRate: "7.00",
				},
			];
			const minimumStake = 0.000001;

			let error: unknown = null;

			try {
				const payload = await serviveB.updateLockup({
					fee,
					feeVault,
					lockupName,
					rewardSchemes,
					minimumStake,
				});
				const signature = await payload.execute({ commitment: "confirmed" });
				console.log("signature:", signature);
			} catch (err) {
				error = err;
			}

			assert(error, "Update lockup by non-creator should fail");
		});
	});
});
