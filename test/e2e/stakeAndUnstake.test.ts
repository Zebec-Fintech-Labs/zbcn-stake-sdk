import assert from "assert";
import { BigNumber } from "bignumber.js";

import { PublicKey } from "@solana/web3.js";
import { getMintDecimals } from "@zebec-network/solana-common";

import {
	createAnchorProvider,
	deriveLockupAddress,
	deriveStakeAddress,
	deriveUserNonceAddress,
	RewardScheme,
	StakeServiceBuilder,
} from "../../src";
import { getBlockTime, getConnection, getWallets, sleep } from "../shared";

function calculateReward(
	rewardScheme: RewardScheme[],
	lockTime: number,
	amount: string | number,
	rewardTokenDecimals: number,
) {
	const scheme = rewardScheme.find((scheme) => scheme.duration == lockTime);
	assert(scheme, `No scheme exists for lockTime: ${lockTime}`);
	const annualRewardRate = BigNumber(scheme.rewardRate.toString()).div(100);
	const rewardAmount = BigNumber(amount)
		.times(annualRewardRate.div(365 * 24 * 60 * 60))
		.times(lockTime)
		.toFixed(rewardTokenDecimals, BigNumber.ROUND_DOWN);

	return rewardAmount;
}

describe("Stake", () => {
	const network = "devnet";
	const connection = getConnection(network, "confirmed");
	const wallets = getWallets(network);
	const wallet = wallets[2];
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	let nonce: bigint;
	const lockupName = "Lockup 002";
	const lockup = deriveLockupAddress(lockupName, service.program.programId);
	const lockPeriod = 30; // sec
	const amount = 1000;

	describe("stake() => unstake()", () => {
		it("transfer token to lockup for staking", async () => {
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
			console.log("BlockTimeA:", new Date(timeA * 1000).toUTCString());
			const signature = await payload.execute({ commitment: "confirmed" });
			const timeB = await getBlockTime(connection, "confirmed");
			console.log("Stake Signature:", signature);

			const timestamps = new Set(Array.from({ length: timeB - timeA + 1 }, (_, i) => (timeA + i).toString()));
			await sleep(3000);

			const stake = deriveStakeAddress(wallet.publicKey, lockup, nonce, service.program.programId);

			const info = await service.getStakeInfo(stake, lockup);
			// console.log("Stake Info:", info);

			assert(info, `Stake info does not exits for stake address: ${stake.toString()}`);
			assert.strictEqual(info.address, stake.toString(), "Stake address does not match");
			console.log("CreatedTime:", new Date(info.createdTime * 1000).toUTCString());
			assert(timestamps.has(info.createdTime.toString()), "Stake created date does not fall within TimeA and TimeB");
			assert.strictEqual(info.lockup, lockup.toString(), "Lockup address of stake does not match");
			assert.strictEqual(info.lockPeriod, lockPeriod, "Lock period does not match");
			assert.strictEqual(info.nonce.toString(), nonce.toString(), "Nonce of stake does not match");
			assert.strictEqual(info.rewardAmount, "0", "Reward amount should be zero");
			assert(!info.stakeClaimed, "Stake should not have been claimed");
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

			const stake = deriveStakeAddress(wallet.publicKey, lockup, nonce, service.program.programId);
			await sleep(3000);

			const info = await service.getStakeInfo(stake, lockup);
			// console.log("Stake Info:", info);

			assert(info, `Stake info does not exits for stake address: ${stake.toString()}`);
			assert.strictEqual(info.address, stake.toString(), "Stake address does not match");
			assert.strictEqual(info.lockup, lockup.toString(), "Lockup address of stake does not match");
			assert.strictEqual(info.nonce.toString(), nonce.toString(), "Nonce of stake does not match");
			assert.strictEqual(info.staker, wallet.publicKey.toString(), "Staker does not match");
			assert(info.stakeClaimed, "Stake should have been claimed");

			const lockupInfo = await service.getLockupInfo(lockup);
			assert(lockupInfo, `LockupInfo does not exists for lockup: ${lockup.toString()}`);
			const rewardTokenDecimals = await getMintDecimals(connection, new PublicKey(lockupInfo.rewardToken.tokenAddress));
			const calculatedReward = calculateReward(
				lockupInfo.stakeInfo.rewardSchemes,
				lockPeriod,
				amount,
				rewardTokenDecimals,
			);
			// console.log("Calculated Reward:", calculatedReward);
			assert.strictEqual(info.rewardAmount, calculatedReward, "Reward amount does not match calculated amount");
		});
	});
});
