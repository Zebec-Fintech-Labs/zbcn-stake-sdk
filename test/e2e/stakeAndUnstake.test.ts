import assert from "assert";

import {
	createAnchorProvider,
	deriveLockupAddress,
	deriveStakeAddress,
	deriveUserNonceAddress,
	StakeServiceBuilder,
} from "../../src";
import { getBlockTime, getConnection, getWallets, sleep } from "../shared";

describe("Stake", () => {
	const network = "devnet";
	const connection = getConnection("devnet", "confirmed");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	let nonce: bigint;
	const lockupName = "Lockup 002";
	const lockup = deriveLockupAddress(lockupName, service.program.programId);

	describe("stake() => unstake()", () => {
		it("transfer token to lockup for staking", async () => {
			const amount = 1000;
			const lockPeriod = 30; // sec
			const userNonceAddress = deriveUserNonceAddress(wallet.publicKey, lockup, service.program.programId);
			const nonceInfo = await service.getUserNonceInfo(userNonceAddress);
			nonce = nonceInfo ? nonceInfo.nonce : 0n;
			console.log("Nonce:", nonce);

			const payload = await service.stake({
				amount,
				lockPeriod,
				nonce,
				lockupName,
			});

			const timeA = await getBlockTime(connection, "confirmed");
			console.log("BlockTimeA:", timeA);
			const signature = await payload.execute({ commitment: "confirmed" });
			const timeB = await getBlockTime(connection, "confirmed");
			console.log("Stake Signature:", signature);

			const timestamps = new Set(Array.from({ length: timeB - timeA + 1 }, (_, i) => (timeA + i).toString()));
			await sleep(3000);

			const stake = deriveStakeAddress(
				"99Ecn3r3f4sjPXrgSdXHYfR1VaEvmkWqZQ3VBoecJHRo",
				lockup,
				nonce,
				service.program.programId,
			);

			const info = await service.getStakeInfo(stake, lockup);
			console.log("Stake Info:", info);

			assert(info, `Stake info does not exits for stake address: ${stake.toString()}`);
			assert.strictEqual(info.address, stake.toString(), "Stake address does not match");
			assert(timestamps.has(info.createdTime.toString()), "Stake created date does not fall within TimeA and TimeB");
			assert.strictEqual(info.lockup, lockup.toString(), "Lockup address of stake does not match");
			assert.strictEqual(info.lockPeriod, lockPeriod, "Lock period does not match");
			assert.strictEqual(info.nonce.toString(), nonce.toString(), "Nonce of stake does not match");
			assert.strictEqual(info.rewardAmount, "0", "Reward amount should be zero");
			assert.strictEqual(!info.stakeClaimed, "Stake should not have been claimed");
			assert.strictEqual(info.staker, wallet.publicKey.toString(), "Staker does not match");
		});

		it("transfer token to lockup for staking", async () => {
			await sleep(30000);

			const payload = await service.unstake({
				nonce,
				lockupName,
			});

			const signature = await payload.execute({ commitment: "confirmed" });
			console.log("Unstake Signature:", signature);

			const stake = deriveStakeAddress(
				"99Ecn3r3f4sjPXrgSdXHYfR1VaEvmkWqZQ3VBoecJHRo",
				lockup,
				nonce,
				service.program.programId,
			);

			const info = await service.getStakeInfo(stake, lockup);
			console.log("Stake Info:", info);

			assert(info, `Stake info does not exits for stake address: ${stake.toString()}`);
			assert.strictEqual(info.address, stake.toString(), "Stake address does not match");
			assert.strictEqual(info.lockup, lockup.toString(), "Lockup address of stake does not match");
			assert.strictEqual(info.nonce.toString(), nonce.toString(), "Nonce of stake does not match");
			assert.notStrictEqual(info.rewardAmount, "0", "Reward amount must not be zero");
			assert.strictEqual(info.stakeClaimed, "Stake should have been claimed");
			assert.strictEqual(info.staker, wallet.publicKey.toString(), "Staker does not match");
		});
	});
});
