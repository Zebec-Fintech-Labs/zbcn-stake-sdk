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
	deriveStakeAddress,
	ZEBEC_STAKE_IDL_V1,
	ZebecStakeIdlV1,
} from "../../src";
import { chunkArray, getConnection, getWallets } from "../shared";

interface StakeInfo {
	wallet: string;
	amount: number;
	createdTime: number;
	lockPeriodInSeconds: number;
	claimed: boolean;
	nonce: number;
}

interface RawStakeData {
	wallet: string;
	amount: number;
	lockTime: number;
	lockDuration: number;
	isRewardClaimed: boolean;
}

describe("Whitelisting Stakers", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet);
	const program = new Program<ZebecStakeIdlV1>(ZEBEC_STAKE_IDL_V1, provider);
	// const service = new StakeServiceBuilder()
	// 	.setNetwork(network)
	// 	.setProvider(provider)
	// 	.setProgram((_) => program)
	// 	.build();
	const SECONDS_IN_A_DAY = 86400;

	describe("prepareData", () => {
		it("should prepare data for whitelist staker", async () => {
			const file = fs.readFileSync(path.join(__dirname, "staking-data-05-25.json"), "utf-8");
			const data: RawStakeData[] = JSON.parse(file);
			assert(Array.isArray(data));

			const stakesMap: Map<string, StakeInfo[]> = new Map<string, StakeInfo[]>();

			for (const datum of data) {
				// Validate input data
				assert(typeof datum.wallet === "string", "Wallet should be a string");
				assert(typeof datum.amount === "number", "Amount should be a number");
				assert(typeof datum.lockTime === "number", "Lock time should be a number");
				assert(typeof datum.lockDuration === "number", "Lock duration should be a number");
				assert(typeof datum.isRewardClaimed === "boolean", "isRewardClaimed should be a boolean");

				const stakeInfo: StakeInfo = {
					wallet: datum.wallet,
					amount: datum.amount,
					createdTime: datum.lockTime,
					lockPeriodInSeconds: datum.lockDuration * SECONDS_IN_A_DAY,
					claimed: datum.isRewardClaimed,
					nonce: 0,
				};

				// Get or create wallet stakes array
				if (!stakesMap.has(datum.wallet)) {
					stakesMap.set(datum.wallet, []);
				}

				stakesMap.get(datum.wallet)!.push(stakeInfo as StakeInfo);
			}

			// Sort stakes by creation time for each wallet and assign nonces
			const allStakes: StakeInfo[] = [];

			for (const [_, stakes] of stakesMap.entries()) {
				// Sort by creation time
				stakes.sort((a, b) => a.createdTime - b.createdTime);

				// Assign nonces and add to final array
				stakes.forEach((stake, index) => {
					stake.nonce = index;
					allStakes.push(stake);
				});
			}

			fs.writeFileSync(path.join(__dirname, "output.json"), JSON.stringify(allStakes, null, 2), "utf-8");
		});
	});

	describe("whitelistStakers", () => {
		it("whitelist stakers", async () => {
			const file = fs.readFileSync(path.join(__dirname, "output.json"), "utf-8");
			const data: StakeInfo[] = JSON.parse(file);
			assert(Array.isArray(data));

			const chunkedArray = chunkArray(data, 5);
			console.log("chunkedList length:", chunkedArray.length);

			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, program.programId);
			console.log("lockup address:", lockup.toString());
			const stakeTokenDecimals = 6;
			const UNITS_PER_TOKEN = 10 ** stakeTokenDecimals;

			for (let i = 438; i < chunkedArray.length; i++) {
				const chunk = chunkedArray[i];
				console.log("chunk: %d, item count: %d", i, chunk.length);

				const ixs = await Promise.all(
					chunk.map(async (item) => {
						const staker = item.wallet;
						const createdTime = item.createdTime;
						const lockPeriodInSeconds = item.lockPeriodInSeconds;
						const nonce = item.nonce;
						const amount = item.amount;
						const claimed = item.claimed;

						assert(typeof staker === "string");
						assert(typeof amount === "number");
						assert(typeof createdTime === "number");
						assert(typeof lockPeriodInSeconds === "number");
						assert(typeof nonce === "number");
						assert(typeof claimed === "boolean");

						// console.log("staker:", staker);
						// console.log("nonce:", nonce);

						const amountInUnits = BigNumber(amount).times(UNITS_PER_TOKEN).toFixed(0);
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
	});

	describe("whitelistSingleStaker", () => {
		it("whitelist single staker", async () => {
			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const lockupName = "Lockup 001";
			const lockup = deriveLockupAddress(lockupName, program.programId);
			// console.log("lockup address:", lockup.toString());
			const stakeTokenDecimals = 6;
			const UNITS_PER_TOKEN = 10 ** stakeTokenDecimals;

			const staker = "5BQwQmwJGBkL4rVjPxbS8JofmEPG2gCPTvxFUwSWfkG8";
			// const staker = wallets[2].publicKey.toString();
			console.log("staker:", staker);
			const nonce = 9;
			const amount = 1000;
			const claimed = false;
			const createdTime = Math.floor(Date.now() / 1000); // Current time in seconds
			const lockPeriodInSeconds = 120;

			const amountInUnits = BigNumber(amount).times(UNITS_PER_TOKEN).toFixed(0);
			const stakePda = deriveStakeAddress(staker, lockup, BigInt(nonce), program.programId);

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
