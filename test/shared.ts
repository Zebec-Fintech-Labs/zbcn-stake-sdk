import assert from "assert";
import dotenv from "dotenv";

import { AnchorProvider, utils, Wallet } from "@coral-xyz/anchor";
import { Cluster, Commitment, Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

dotenv.config();

export function getConnection(
	cluster?: "mainnet-beta" | "devnet",
	commitment: "confirmed" | "finalized" = "finalized",
) {
	const network = cluster ? cluster : "mainnet-beta";
	const RPC_URL = network === "devnet" ? process.env.DEVNET_RPC_URL : process.env.RPC_URL;
	assert(RPC_URL && RPC_URL !== "", `missing env var: ${network === "devnet" ? "DEVNET_RPC_URL" : "RPC_URL"}`);

	return new Connection(RPC_URL, commitment);
}

export async function sleep(ms: number) {
	return await new Promise((r) => setTimeout(r, ms));
}

export function getWallets(cluster?: Cluster) {
	const SECRET_KEYS =
		cluster && cluster === "mainnet-beta" ? process.env.MAINNET_SECRET_KEYS : process.env.DEVNET_SECRET_KEYS;

	assert(
		SECRET_KEYS && SECRET_KEYS != "",
		`missing env var: ${cluster === "mainnet-beta" ? "MAINNET_SECRET_KEYS" : "DEVNET_SECRET_KEYS"}`,
	);

	const keypairs: Keypair[] = [];
	try {
		const secretKeys = JSON.parse(SECRET_KEYS);

		assert(Array.isArray(secretKeys), "Invalid format for SECRET_KEYS");

		for (const keys of secretKeys) {
			// console.log("secret key", keys);
			assert(keys && typeof keys === "string" && keys != "", "Invalid secret key");

			const keypair = Keypair.fromSecretKey(utils.bytes.bs58.decode(keys));
			// console.log(Buffer.from(keypair.secretKey).toJSON());

			keypairs.push(keypair);
		}
	} catch (err: any) {
		throw new Error("Some error occured parsing secret key: " + err.message);
	}

	const wallets: Wallet[] = [];

	for (const keypair of keypairs) {
		wallets.push(new Wallet(keypair));
	}

	return wallets;
}

export function nowInSec() {
	return Math.floor(Date.now() / 1000);
}

export function getSignTransaction(provider: AnchorProvider) {
	const signTransaction = <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
		return provider.wallet.signTransaction(tx);
	};

	return signTransaction;
}

export function getTxUrl(tx: string, cluster: Cluster = "mainnet-beta") {
	if (!cluster || cluster === "mainnet-beta") {
		return "https://solscan.io/tx/" + tx;
	}

	return "https://solscan.io/tx/" + tx + "?cluster=" + cluster;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}

	return result;
}

export async function getBlockTime(connection: Connection, commitment: Commitment) {
	const time = await connection.getBlockTime(await connection.getSlot(commitment));
	return time!;
}
