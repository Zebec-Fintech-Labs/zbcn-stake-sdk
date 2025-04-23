import { Address, AnchorProvider, BN, Program, Provider, translateAddress } from "@coral-xyz/anchor";
import {
	AddressLookupTableAccount,
	clusterApiUrl,
	Connection,
	PublicKey,
	Signer,
	TransactionInstruction,
} from "@solana/web3.js";

import { STAKE_IDL_V1, StakeIdlV1 } from "./artifacts";
import { SignTransactionFunction, TransactionPayload } from "./payload";
import { createReadonlyProvider, ReadonlyProvider } from "./providers";

type ProgramCreateFunction = (provider: ReadonlyProvider | AnchorProvider) => Program<StakeIdlV1>;

/**
 * StakeServiceBuilder is a builder class for creating a StakeService instance.
 * It allows you to set the network, provider, and program to use.
 */
export class StakeServiceBuilder {
	private _program: Program<StakeIdlV1> | undefined;
	private _provider: ReadonlyProvider | AnchorProvider | undefined;
	private _network: "mainnet-beta" | "devnet" | undefined;

	/**
	 *
	 * @param network The network to use. If not set, a default network: 'mainnet-beta' will be used.
	 * @returns
	 */
	setNetwork(network?: "mainnet-beta" | "devnet"): StakeServiceBuilder {
		if (this._network) {
			throw new Error("InvalidOperation: Network is set twice.");
		}

		this._network = network ? network : "mainnet-beta";

		return this;
	}

	/**
	 * Set the provider to use. If not set, a default provider will be created.
	 * @param provider The provider to use. If not set, a default provider: 'ReadonlyProvider' will be created.
	 * @returns The StakeServiceBuilder instance.
	 */
	setProvider(provider?: ReadonlyProvider | AnchorProvider): StakeServiceBuilder {
		if (this._provider) {
			throw new Error("InvalidOperation: Provider is set twice.");
		}

		if (!this._network) {
			throw new Error("InvalidOperation: Network is not set. Please set the network before setting the provider.");
		}

		if (provider) {
			this.validateProviderNetwork(provider, this._network);

			this._provider = provider;
		} else {
			this._provider = createReadonlyProvider(new Connection(clusterApiUrl(this._network)));
		}

		return this;
	}

	/**
	 *
	 * @param provider The provider to compare with.
	 */
	private validateProviderNetwork(provider: ReadonlyProvider | AnchorProvider, network: string) {
		const connection = provider.connection;
		const rpcEndpoint = connection.rpcEndpoint;
		const connNetwork = rpcEndpoint.includes("devnet")
			? "devnet"
			: rpcEndpoint.includes("testnet")
				? "testnet"
				: "mainnet-beta";

		if (connNetwork === "testnet") {
			throw new Error(
				"InvalidOperation: Testnet is not supported. Please use connection with devnet or mainnet-beta network.",
			);
		}

		if (network !== connNetwork) {
			throw new Error(
				`InvalidOperation: Network mismatch. network and connection network should be same. network: ${this._network}, connection: ${connNetwork}`,
			);
		}
	}

	/**
	 * Set the program to use. If not set, a default program will be created.
	 * @param program The program to use. If not set, a default program will be created.
	 * @returns The StakeServiceBuilder instance.
	 */
	setProgram(createProgram?: ProgramCreateFunction): StakeServiceBuilder {
		if (this._program) {
			throw new Error("InvalidOperation: Program is set twice.");
		}

		if (!this._network) {
			throw new Error("InvalidOperation: Network is not set. Please set the network before setting the provider.");
		}

		if (!this._provider) {
			throw new Error("InvalidOperation: Provider is not set. Please set the provider before setting the program.");
		}

		this._program = !createProgram ? new Program(STAKE_IDL_V1, this._provider) : createProgram(this._provider);

		return this;
	}

	build(): StakeService {
		if (!this._network) {
			throw new Error("InvalidOperation: Network is not set. Please set the network before building the service.");
		}

		if (!this._provider) {
			throw new Error("InvalidOperation: Provider is not set. Please set the provider before building the service.");
		}

		if (!this._program) {
			throw new Error("InvalidOperation: Program is not set. Please set the program before building the service.");
		}

		return new StakeService(this._provider, this._program, this._network);
	}
}

export class StakeService {
	constructor(
		readonly provider: Provider,
		readonly stakeProgram: Program<StakeIdlV1>,
		readonly network: "mainnet-beta" | "devnet",
	) {}

	private async _createPayload(
		payerKey: PublicKey,
		instructions: TransactionInstruction[],
		signers?: Signer[],
		addressLookupTableAccounts?: AddressLookupTableAccount[],
	): Promise<TransactionPayload> {
		const errorMap: Map<number, string> = new Map();
		this.stakeProgram.idl.errors.forEach((error) => errorMap.set(error.code, error.msg));

		let signTransaction: SignTransactionFunction | undefined = undefined;

		const provider = this.provider;

		if (provider instanceof AnchorProvider) {
			signTransaction = async (tx) => {
				return provider.wallet.signTransaction(tx);
			};
		}

		return new TransactionPayload(
			this.provider.connection,
			errorMap,
			instructions,
			payerKey,
			signers,
			addressLookupTableAccounts,
			signTransaction,
		);
	}

	async getInitLockupInstruction(
		creator: PublicKey,
		stakeToken: PublicKey,
		rewardToken: PublicKey,
	): Promise<TransactionInstruction> {
		return this.stakeProgram.methods.initLockup().accounts({ rewardToken, stakeToken, creator }).instruction();
	}

	async getStakeInstruction(stakeToken: PublicKey, staker: PublicKey): Promise<TransactionInstruction> {
		return this.stakeProgram.methods.stakeZbcn().accounts({ stakeToken, staker }).instruction();
	}

	async getUnstakeInstruction(
		feeVault: PublicKey,
		rewardToken: PublicKey,
		stakeToken: PublicKey,
		staker: PublicKey,
		nonce: BN,
	): Promise<TransactionInstruction> {
		return this.stakeProgram.methods
			.unstakeZbcn(nonce)
			.accounts({ feeVault, rewardToken, stakeToken, staker })
			.instruction();
	}

	async initLockup(creator: Address, stakeToken: Address, rewardToken: Address): Promise<TransactionPayload> {
		const creatorKey = translateAddress(creator);
		const stakeTokenKey = translateAddress(stakeToken);
		const rewardTokenKey = translateAddress(rewardToken);

		const instruction = await this.getInitLockupInstruction(creatorKey, stakeTokenKey, rewardTokenKey);

		return this._createPayload(creatorKey, [instruction]);
	}

	async stake(staker?: Address): Promise<TransactionPayload> {
		const stakerKey = staker ? translateAddress(staker) : this.provider.publicKey;

		if (!stakerKey) {
			throw new Error("MissingArgument: Please provide either staker address or publicKey in provider");
		}

		const instruction = await this.getStakeInstruction(stakerKey, stakerKey); // todo: add stakeToken

		return this._createPayload(stakerKey, [instruction]);
	}

	async unstake(nonce: bigint, staker?: Address): Promise<TransactionPayload> {
		const stakerKey = staker ? translateAddress(staker) : this.provider.publicKey;

		if (!stakerKey) {
			throw new Error("MissingArgument: Please provide either staker address or publicKey in provider");
		}

		console.log("nonce:", nonce);

		const instruction = await this.getUnstakeInstruction(stakerKey, stakerKey, stakerKey, stakerKey, new BN(0)); // todo: add feeVault and rewardToken

		return this._createPayload(stakerKey, [instruction]);
	}
}
