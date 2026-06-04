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
		const mint = new PublicKey("So11111111111111111111111111111111111111112");
		const owner = new PublicKey("7sY7B38ToeHMeiewXFEHN7FNeibQ3J9D5HBDtqVPSggb");
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
