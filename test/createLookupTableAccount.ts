import { describe } from "mocha";

import { web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { getConnection, getWallets } from "./shared";

describe("lookup table actions", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallet = getWallets(network)[0];
	console.log("provider:", wallet.publicKey.toString());

	let lookupTableAddressGlob: web3.PublicKey;

	it("create address lookup table", async () => {
		// use about 0.003 SOL for two txs;

		const slot = await connection.getSlot();
		const [lookupTableInst, lookupTableAddress] = web3.AddressLookupTableProgram.createLookupTable({
			authority: wallet.publicKey, // The authority (i.e., the account with permission to modify the lookup table)

			payer: wallet.publicKey, // The payer (i.e., the account that will pay for the transaction fees)

			recentSlot: slot - 1, // The recent slot to derive lookup table's address
		});
		console.log("lookup address:", lookupTableAddress.toString());
		lookupTableAddressGlob = lookupTableAddress;

		const lbh = await connection.getLatestBlockhash();
		const tm = new web3.TransactionMessage({
			instructions: [lookupTableInst],
			payerKey: wallet.publicKey,
			recentBlockhash: lbh.blockhash,
		});

		const vtx = new web3.VersionedTransaction(tm.compileToV0Message());
		const signed = await wallet.signTransaction(vtx);

		const sig = await connection.sendRawTransaction(signed.serialize());
		console.log("sig:", sig);

		await connection.confirmTransaction({
			signature: sig,
			blockhash: lbh.blockhash,
			lastValidBlockHeight: lbh.lastValidBlockHeight,
		});
	});

	it("extends address lookup table", async () => {
		// const lookupTable = new web3.PublicKey("HCD4FqdYayUzUPSxSswPiEo4r7rPwd8KSvf3tqYB91SL");
		const lookupTable = new PublicKey("C4R2sL6yj7bzKfbdfwCfH68DZZ3QnzdmedE9wQqTfAAA"); // devnet

		const addresses = [
			// new PublicKey("De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc"), // stake token
			// new PublicKey("5Rosz64MhKQEqDfnWU9pDTsjXZ6fMwryiLgTSGiXUbxU"), // lockup
			// new PublicKey("CxGWhBSj833PkjiJWhp3LiGMdQsqURkvCfigQ5Q4YNSK"), // admin
			// new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), // associated token program
			// new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // token program
			// new PublicKey("11111111111111111111111111111111"), // system program
			// new PublicKey("zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv"), // stake program
			// new PublicKey("DrxrMnUsyn5T6LRbnA1Zad4cYY6saSUSrhsdNJyJZyAN"), // lockup
			// reward token
			new PublicKey("85qTFUzp3t1e9Cc7b2mch6aLr8hQBp4UWbJrvxpuZmxt"), // stake vault
			new PublicKey("4au4Q3amh3teocWEGCk3waqPHyXTvXR72n3sN7STkFtN"), // stake vault ata
			new PublicKey("Axs2XYZFin5pFCu3K1TnhByVgR7K2bghKKUG9eCLHu6Q"), // reward vault
			new PublicKey("4au4Q3amh3teocWEGCk3waqPHyXTvXR72n3sN7STkFtN"), // rewared vault ata
			new PublicKey("AA8B8zv68QCT8pkJL9vd6nAG9MzopARH9xvY1CLgAQQQ"), // fee vault
			new PublicKey("7YCpVsBaTxErZKow4LK77qzKNM3AUCUMS9MTp3WPZCKc"), // fee vault ata

			// new PublicKey("EWXAHuP4VRL4twjiH4B1t3kiQFDjKcjdz1XPvnHM6kR3"), // lockup
			// new PublicKey("AYbW5cbZEUgLEj6Eiy3yg74PU3YbEHkbFxgW6fjbSJjp"),
			// new PublicKey("DWwty3vnpMWsJagibYWPNmJ2BGELHow4vKm5nK79btoC"),
			// new PublicKey("7oKEHLFXbya57ZixovrDStQCxWpVJmisHszLSSiZXPdG"),
			// new PublicKey("ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU"),
			// new PublicKey("zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv"),
		];

		// Create an instruction to extend a lookup table with the provided addresses

		const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
			payer: wallet.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
			authority: wallet.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
			lookupTable, // The address of the lookup table to extend
			addresses: addresses, // The addresses to add to the lookup table
		});

		const lbh = await connection.getLatestBlockhash();
		const mesage = new web3.TransactionMessage({
			instructions: [extendInstruction],
			payerKey: wallet.publicKey,
			recentBlockhash: lbh.blockhash,
		});

		const vtx = new web3.VersionedTransaction(mesage.compileToV0Message());
		const signedVtx = await wallet.signTransaction(vtx);

		const signature = await connection.sendRawTransaction(signedVtx.serialize());
		console.log("signature", signature);
		await connection.confirmTransaction({
			signature: signature,
			blockhash: lbh.blockhash,
			lastValidBlockHeight: lbh.lastValidBlockHeight,
		});
	});

	it("list lookup table account addresses", async () => {
		const lookupTable = new PublicKey("C4R2sL6yj7bzKfbdfwCfH68DZZ3QnzdmedE9wQqTfAAA");

		const lookupTables = await connection.getAddressLookupTable(lookupTable);
		const lookupTableAccount = lookupTables.value!;
		console.log("Lookup table address: [");
		lookupTableAccount.state.addresses.map((a) => console.log("  ", a.toString()));
		console.log("]");
		console.log("authority", lookupTableAccount.state.authority?.toString());
	});
});
