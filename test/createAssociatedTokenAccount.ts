import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { describe, it } from "mocha";

import { getConnection, getWallets } from "./shared";

const network = "mainnet-beta";
const connection = getConnection(network);
const wallets = getWallets(network);
const wallet = wallets[0];

describe("create associated token account utility", () => {
	it("creates associated token account", async () => {
		const mint = new PublicKey("ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU");
		const owner = new PublicKey("67BvmUwjr9UtexrjMPzBjG6LEEmeHi7q4tZUSbw62Cjb");
		const tokenAccount = await getOrCreateAssociatedTokenAccount(
			connection,
			wallet.payer,
			mint,
			owner,
			true,
			"confirmed",
			{
				commitment: "confirmed",
			},
		);

		console.log("token account:", tokenAccount.address);
		console.log("token account mint: ", tokenAccount.mint);
		console.log("token account owner:", tokenAccount.owner);
	});
});
