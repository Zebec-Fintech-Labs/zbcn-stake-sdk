import assert from "assert";

import { createAnchorProvider, deriveLockupAddress, RewardScheme, StakeServiceBuilder } from "../../src";
import { getConnection, getWallets } from "../shared";

describe("Init Lockup", () => {
	const network = "devnet";
	const connection = getConnection(network, "confirmed");
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("initLock()", () => {
		it("initialize staking lock", async () => {
			const rewardToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const fee = 0;
			const feeVault = "AA8B8zv68QCT8pkJL9vd6nAG9MzopARH9xvY1CLgAQQQ";
			const name = `Lockup_${Date.now()}`;
			const rewardSchemes: RewardScheme[] = [
				{
					// duration: 2592000, // 30 days
					duration: 30,
					rewardRate: "8.00",
				},
				{
					// duration: 7776000, // 90 days
					duration: 90,
					rewardRate: "12.00",
				},
				{
					// duration: 10368000, // 120 days
					duration: 120,
					rewardRate: "15.00",
				},
			];
			const minimumStake = 0.000001;

			/** mainnet-beta */
			// const rewardToken = "ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU";
			// const stakeToken = "ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU";
			// const fee = 0;
			// const feeVault = "2Nz9xczcGaWvu5pZNzzXundLEdP5tf2aCAoWy4CGrjxD";
			// const name = `ZBCN_Lockup_${Date.now()}`;
			// const rewardSchemes: RewardScheme[] = [
			// 	{
			// 		duration: 2592000, // 30 days
			// 		// duration: 30,
			// 		rewardRate: "8",
			// 	},
			// 	{
			// 		duration: 7776000, // 90 days
			// 		// duration: 90,
			// 		rewardRate: "12",
			// 	},
			// 	{
			// 		duration: 10368000, // 120 days
			// 		// duration: 120,
			// 		rewardRate: "15",
			// 	},
			// ];
			// const minimumStake = 0.1;

			const payload = await service.initLockup({
				rewardToken,
				stakeToken,
				fee,
				feeVault,
				name,
				rewardSchemes,
				minimumStake,
			});

			const signature = await payload.execute({ commitment: "confirmed" });
			console.log("signature:", signature);

			const transaction = await connection.getTransaction(signature, {
				commitment: "confirmed",
				maxSupportedTransactionVersion: 0,
			});
			assert(transaction, `Transaction does not exists for signature: ${signature}`);

			const lockupAddress = deriveLockupAddress(name, service.programId);
			const lockupInfo = await service.getLockupInfo(lockupAddress);

			assert(lockupInfo, `Lockup Info does not exists for name: ${name}, lockup: ${lockupAddress.toString()}`);
			assert.strictEqual(lockupInfo.address, lockupAddress.toString(), "Address does not match in lockup info");
			assert.strictEqual(lockupInfo.feeInfo.fee, fee.toString(), "Fee does not match in lockup info");
			assert.strictEqual(lockupInfo.feeInfo.feeVault, feeVault, "Fee does not match in lockup info");
			assert.strictEqual(
				lockupInfo.rewardToken.tokenAddress,
				rewardToken,
				"Reward Token does not match in lockup info",
			);
			assert.strictEqual(lockupInfo.stakeToken.tokenAdress, stakeToken, "Stake Token does not match in lockup info");
			assert.strictEqual(
				lockupInfo.stakeInfo.creator,
				wallet.publicKey.toString(),
				"Creator does not match in lockup info",
			);
			assert.strictEqual(
				lockupInfo.stakeInfo.minimumStake,
				minimumStake.toString(),
				"Minimum stake does not match in lockup info",
			);
			assert.strictEqual(lockupInfo.stakeInfo.name, name, "Name does not match in lockup info");
			assert.deepStrictEqual(
				lockupInfo.stakeInfo.rewardSchemes,
				rewardSchemes,
				"Reward Schemes does not match in lockup info",
			);
		});
	});
});
