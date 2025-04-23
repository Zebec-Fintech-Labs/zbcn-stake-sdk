import { Address, AnchorProvider, translateAddress } from "@coral-xyz/anchor";
import { ConfirmOptions, Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export class ReadonlyProvider {
	readonly connection: Connection;
	readonly walletAddress?: PublicKey;

	constructor(connection: Connection, walletAddress?: Address) {
		this.connection = connection;
		this.walletAddress = walletAddress ? translateAddress(walletAddress) : undefined;
	}
}

export function createReadonlyProvider(connection: Connection, walletAddress?: Address): ReadonlyProvider {
	return new ReadonlyProvider(connection, walletAddress);
}

/**
 * Wallet interface used by Anchor Framework
 */
export interface AnchorWallet {
	signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
	signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
	publicKey: PublicKey;
}

export function createAnchorProvider(
	connection: Connection,
	wallet: AnchorWallet,
	options?: ConfirmOptions,
): AnchorProvider {
	return new AnchorProvider(connection, wallet, {
		...AnchorProvider.defaultOptions(),
		...options,
	});
}
