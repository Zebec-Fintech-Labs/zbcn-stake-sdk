import assert from "assert";
import dotenv from "dotenv";

import { AnchorProvider, utils, Wallet } from "@coral-xyz/anchor";
import { Cluster, clusterApiUrl, Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

dotenv.config();

export function getConnection(cluster?: Cluster) {
	if (!cluster || cluster === "mainnet-beta") {
		const RPC_URL = process.env.RPC_URL;
		assert(RPC_URL && RPC_URL !== "", "missing env var: RPC_URL");
		return new Connection(RPC_URL);
	}

	return new Connection(clusterApiUrl(cluster));
}

export function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

export function getWallets(cluster?: Cluster) {
	const SECRET_KEYS =
		cluster && cluster === "mainnet-beta" ? process.env.MAINNET_SECRET_KEYS : process.env.DEVNET_SECRET_KEYS;

	assert(SECRET_KEYS && SECRET_KEYS != "", "missing env var: SECRET_KEYS");
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
