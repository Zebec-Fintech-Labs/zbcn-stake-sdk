import assert from "assert";
import { BigNumber } from "bignumber.js";
import { BN } from "bn.js";
import * as fs from "fs";
import path from "path";

import { Program } from "@coral-xyz/anchor";
import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

import {
	createAnchorProvider,
	deriveLockupAddress,
	deriveRewardVaultAddress,
	deriveStakeAddress,
	deriveStakeVaultAddress,
	StakeServiceBuilder,
	ZEBEC_STAKE_IDL_V1,
	ZebecStakeIdlV1,
} from "../../src";
import { chunkArray, getConnection, getWallets } from "../shared";

describe("Whitelist Stakers", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet);
	const program = new Program<ZebecStakeIdlV1>(ZEBEC_STAKE_IDL_V1, provider);
	const service = new StakeServiceBuilder()
		.setNetwork(network)
		.setProvider(provider)
		.setProgram((_) => program)
		.build();
	const SECONDS_IN_A_DAY = 86400;

	describe("prepareData", () => {
		it("should prepare data for whitelist staker", async () => {
			const file = fs.readFileSync(path.join(__dirname, "staking-data-05-25.json"), "utf-8");
			const data = JSON.parse(file);
			assert(Array.isArray(data));

			interface StakeInfo {
				wallet: string;
				amount: number;
				createdTime: number;
				lockPeriodInSeconds: number;
				isRewardClaimed: boolean;
			}

			let stakingData: Map<string, StakeInfo[]> = new Map<string, StakeInfo[]>();

			data
				.map((datum) => {
					const wallet = datum.wallet;
					const amount = datum.amount;
					const createdTime = datum.lockTime;
					const lockPeriodInDays = datum.lockDuration;
					const isRewardClaimed = datum.isRewardClaimed;

					assert(typeof wallet === "string");
					assert(typeof amount === "number");
					assert(typeof createdTime === "number");
					assert(typeof lockPeriodInDays === "number");
					assert(typeof isRewardClaimed === "boolean");

					return {
						wallet,
						amount,
						createdTime,
						lockPeriodInSeconds: lockPeriodInDays * SECONDS_IN_A_DAY,
						isRewardClaimed,
					};
				})
				.map((item) => {
					if (!stakingData.has(item.wallet)) {
						stakingData.set(item.wallet, []);
					}

					const curentStakes = stakingData.get(item.wallet)!;
					const stakeInfo: StakeInfo = {
						wallet: item.wallet,
						amount: item.amount,
						createdTime: item.createdTime,
						lockPeriodInSeconds: item.lockPeriodInSeconds,
						isRewardClaimed: item.isRewardClaimed,
					};

					curentStakes.push(stakeInfo);
					curentStakes.sort((a, b) => {
						const cmp = BigNumber(a.createdTime).comparedTo(b.createdTime);
						assert(cmp != null, "Comparison result should not be null");
						return cmp;
					});
				});

			fs.writeFileSync(
				path.join(__dirname, "staking-data-05-25-processed.json"),
				JSON.stringify(Array.from(stakingData.entries()), null, 2),
				"utf-8",
			);
		});
	});

	describe("whitelistStaker()", () => {
		it("whitelist stakers", async () => {
			const file = fs.readFileSync(path.join(__dirname, "output.json"), "utf-8");
			const data = JSON.parse(file);
			assert(Array.isArray(data));

			const chunkedArray = chunkArray(data, 5);
			console.log("chunkedList length:", chunkedArray.length);

			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, program.programId);
			console.log("lockup address:", lockup.toString());
			const stakeTokenDecimals = 6;
			const UNITS_PER_TOKEN = 10 ** stakeTokenDecimals;

			for (let i = 17; i < chunkedArray.length; i++) {
				const chunk = chunkedArray[i];
				console.log("chunk:", i, "length:", chunk.length);

				const ixs = await Promise.all(
					chunk.map(async (item) => {
						const staker = item.wallet;
						const createdTime = item.lockTime;
						const lockPeriodInDays = item.lockDuration;
						const nonce = item.nonce;
						const amount = item.amount;
						const claimed = item.isRewardClaimed;

						assert(typeof staker === "string");
						assert(typeof amount === "number");
						assert(typeof createdTime === "number");
						assert(typeof lockPeriodInDays === "number");
						assert(typeof nonce === "number");
						assert(typeof claimed === "boolean");

						console.log("staker:", staker);
						console.log("nonce:", nonce);

						const amountInUnits = BigNumber(amount).times(UNITS_PER_TOKEN).toFixed(0);
						const lockPeriodInSeconds = lockPeriodInDays * SECONDS_IN_A_DAY; // Convert days to seconds
						const stakePda = deriveStakeAddress(staker, lockup, BigInt(nonce), program.programId);

						return program.methods
							.whitelistStaker({
								amount: new BN(amountInUnits),
								createdTime: new BN(createdTime),
								lockPeriod: new BN(lockPeriodInSeconds),
								nonce: new BN(nonce),
								claimed: claimed,
							})
							.accountsPartial({
								lockup,
								staker,
								stakeToken,
								stakePda,
							})
							.instruction();
					}),
				);

				const lbh = await provider.connection.getLatestBlockhash();
				const message = new TransactionMessage({
					instructions: ixs,
					recentBlockhash: lbh.blockhash,
					payerKey: wallet.publicKey,
				});

				const lookupTable = new PublicKey("C4R2sL6yj7bzKfbdfwCfH68DZZ3QnzdmedE9wQqTfAAA");
				const lookupTables = await connection.getAddressLookupTable(lookupTable);
				const lookupTableAccount = lookupTables.value;
				assert(lookupTableAccount, "Lookup table account not found");

				const versionMessage = message.compileToV0Message([lookupTableAccount]);

				const tx = new VersionedTransaction(versionMessage);

				tx.sign([wallet.payer]);

				const signature = await connection.sendRawTransaction(tx.serialize(), {
					preflightCommitment: "processed",
				});

				await connection.confirmTransaction(
					{ blockhash: lbh.blockhash, lastValidBlockHeight: lbh.lastValidBlockHeight, signature },
					"confirmed",
				);

				console.log("tx:", signature);
			}
		});

		it("whitelist single staker", async () => {
			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, program.programId);
			console.log("lockup address:", lockup.toString());
			const stakeTokenDecimals = 6;
			const UNITS_PER_TOKEN = 10 ** stakeTokenDecimals;

			const staker = "Bux7a8ifBH9zmbh6pJ4erL8v5BjsWZ97G3R7gLyxMGgH";
			const createdTime = Math.floor(Date.now() / 1000); // Current time in seconds
			// const lockPeriodInDays = 30;
			const nonce = 3;
			const amount = 1000;
			const claimed = true;

			console.log("staker:", staker);
			console.log("nonce:", nonce);

			const amountInUnits = BigNumber(amount).times(UNITS_PER_TOKEN).toFixed(0);
			const lockPeriodInSeconds = 30; // Convert days to seconds
			const stakePda = deriveStakeAddress(staker, lockup, BigInt(nonce), program.programId);

			const stakeVault = deriveStakeVaultAddress(lockup, program.programId);
			console.log("stakeVault:", stakeVault.toString());
			const rewardVault = deriveRewardVaultAddress(lockup, program.programId);
			console.log("rewardVault:", rewardVault.toString());

			const ix = await program.methods
				.whitelistStaker({
					amount: new BN(amountInUnits),
					createdTime: new BN(createdTime),
					lockPeriod: new BN(lockPeriodInSeconds),
					nonce: new BN(nonce),
					claimed: claimed,
				})
				.accountsPartial({
					lockup,
					staker,
					stakeToken,
					stakePda,
				})
				.instruction();

			const lbh = await provider.connection.getLatestBlockhash();
			const message = new TransactionMessage({
				instructions: [ix],
				recentBlockhash: lbh.blockhash,
				payerKey: wallet.publicKey,
			});

			const lookupTable = new PublicKey("C4R2sL6yj7bzKfbdfwCfH68DZZ3QnzdmedE9wQqTfAAA");
			const lookupTables = await connection.getAddressLookupTable(lookupTable);
			const lookupTableAccount = lookupTables.value;
			assert(lookupTableAccount, "Lookup table account not found");

			const versionMessage = message.compileToV0Message([lookupTableAccount]);

			const tx = new VersionedTransaction(versionMessage);

			tx.sign([wallet.payer]);

			const signature = await connection.sendRawTransaction(tx.serialize(), {
				preflightCommitment: "processed",
			});

			await connection.confirmTransaction(
				{ blockhash: lbh.blockhash, lastValidBlockHeight: lbh.lastValidBlockHeight, signature },
				"confirmed",
			);

			console.log("tx:", signature);
		});
	});
});
