import { BigNumber } from "bignumber.js";

import { Address, AnchorProvider, BN, Program, Provider, translateAddress } from "@coral-xyz/anchor";
import {
	AddressLookupTableAccount,
	clusterApiUrl,
	Connection,
	PublicKey,
	Signer,
	TransactionInstruction,
} from "@solana/web3.js";
import { getMintDecimals, SignTransactionFunction, TransactionPayload } from "@zebec-network/solana-common";

import { ZEBEC_STAKE_IDL_V1, ZebecStakeIdlV1 } from "./artifacts";
import { TEN_BIGNUM } from "./constants";
import { deriveLockupAddress, deriveRewardVaultAddress, deriveStakeVaultAddress } from "./pda";
import { createReadonlyProvider, ReadonlyProvider } from "./providers";

type ProgramCreateFunction = (provider: ReadonlyProvider | AnchorProvider) => Program<ZebecStakeIdlV1>;

/**
 * StakeServiceBuilder is a builder class for creating a StakeService instance.
 * It allows you to set the network, provider, and program to use.
 */
export class StakeServiceBuilder {
	private _program: Program<ZebecStakeIdlV1> | undefined;
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
				: rpcEndpoint.includes("localhost:8899")
					? "localnet"
					: "mainnet-beta";

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

		this._program = !createProgram ? new Program(ZEBEC_STAKE_IDL_V1, this._provider) : createProgram(this._provider);

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
		readonly program: Program<ZebecStakeIdlV1>,
		readonly network: "mainnet-beta" | "devnet",
	) {}

	private async _createPayload(
		payerKey: PublicKey,
		instructions: TransactionInstruction[],
		signers?: Signer[],
		addressLookupTableAccounts?: AddressLookupTableAccount[],
	): Promise<TransactionPayload> {
		const errorMap: Map<number, string> = new Map();
		this.program.idl.errors.forEach((error) => errorMap.set(error.code, error.msg));

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
		lockup: PublicKey,
		stakeToken: PublicKey,
		rewardToken: PublicKey,
		rewardVault: PublicKey,
		stakeVault: PublicKey,
		data: InitLockupInstructionData,
	): Promise<TransactionInstruction> {
		return this.program.methods
			.initLockup({
				fee: data.fee,
				durationMap: data.rewardSchemes,
				feeVault: data.feeVault,
				name: data.name,
			})
			.accountsPartial({
				// associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				creator,
				lockup,
				rewardToken,
				rewardVault,
				stakeToken,
				stakeVault,
				// systemProgram: SystemProgram.programId,
				// tokenProgram: TOKEN_PROGRAM_ID
			})
			.instruction();
	}

	async getStakeInstruction(
		stakeToken: PublicKey,
		staker: PublicKey,
		data: StakeInstructionData,
	): Promise<TransactionInstruction> {
		return this.program.methods.stakeZbcn(data).accounts({ stakeToken, staker }).instruction();
	}

	async getUnstakeInstruction(
		feeVault: PublicKey,
		rewardToken: PublicKey,
		stakeToken: PublicKey,
		staker: PublicKey,
		nonce: BN,
	): Promise<TransactionInstruction> {
		return this.program.methods
			.unstakeZbcn(nonce)
			.accounts({ feeVault, rewardToken, stakeToken, staker })
			.instruction();
	}

	async initLockup(params: {
		stakeToken: Address;
		rewardToken: Address;
		creator?: Address;
		name: string;
		fee: Numeric;
		feeVault: Address;
		rewardSchemes: RewardScheme[];
	}): Promise<TransactionPayload> {
		const creator = params.creator ? translateAddress(params.creator) : this.provider.publicKey;

		if (!creator) {
			throw new Error("MissingArgument: Please provide either creator address or publicKey in provider");
		}
		const stakeToken = translateAddress(params.stakeToken);
		const rewardToken = translateAddress(params.rewardToken);
		const feeVault = translateAddress(params.feeVault);

		const stakeTokenDecimals = await getMintDecimals(this.provider.connection, stakeToken);
		const rewardTokenDecimals = await getMintDecimals(this.provider.connection, rewardToken);

		const rewardSchemes = params.rewardSchemes.map<ParsedRewardScheme>((value) => {
			return {
				duration: new BN(value.duration),
				reward: new BN(BigNumber(value.reward).times(TEN_BIGNUM.pow(rewardTokenDecimals)).toFixed()),
			};
		});

		const lockup = deriveLockupAddress(params.name, this.program.programId);
		const rewardVault = deriveRewardVaultAddress(lockup, this.program.programId);
		const stakeVault = deriveStakeVaultAddress(lockup, this.program.programId);

		const fee = new BN(BigNumber(params.fee).times(TEN_BIGNUM.pow(stakeTokenDecimals)).toFixed());
		const instruction = await this.getInitLockupInstruction(
			creator,
			lockup,
			stakeToken,
			rewardToken,
			rewardVault,
			stakeVault,
			{
				fee,
				feeVault: feeVault,
				name: params.name,
				rewardSchemes,
			},
		);

		return this._createPayload(creator, [instruction]);
	}

	async stake(params: {
		lockupName: string;
		staker?: Address;
		amount: Numeric;
		lockPeriod: number;
		nonce: bigint;
	}): Promise<TransactionPayload> {
		const staker = params.staker ? translateAddress(params.staker) : this.provider.publicKey;

		if (!staker) {
			throw new Error("MissingArgument: Please provide either staker address or publicKey in provider");
		}

		const lockupAddress = deriveLockupAddress(params.lockupName, this.program.programId);

		const lockupAccount = await this.program.account.lockup.fetchNullable(
			lockupAddress,
			this.provider.connection.commitment,
		);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeToken = lockupAccount.stakedToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.provider.connection, stakeToken);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);

		const instruction = await this.getStakeInstruction(stakeToken, staker, {
			amount: new BN(BigNumber(params.amount).times(UNITS_PER_STAKE_TOKEN).toFixed(0)),
			lockPeriod: new BN(params.lockPeriod),
			nonce: new BN(params.nonce.toString()),
		});

		return this._createPayload(staker, [instruction]);
	}

	async unstake(params: { lockupName: string; nonce: bigint; staker?: Address }): Promise<TransactionPayload> {
		const staker = params.staker ? translateAddress(params.staker) : this.provider.publicKey;

		if (!staker) {
			throw new Error("MissingArgument: Please provide either staker address or publicKey in provider");
		}

		const lockupAddress = deriveLockupAddress(params.lockupName, this.program.programId);

		const lockupAccount = await this.program.account.lockup.fetchNullable(
			lockupAddress,
			this.provider.connection.commitment,
		);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeToken = lockupAccount.stakedToken.tokenAddress;
		const rewardToken = lockupAccount.rewardToken.tokenAddress;
		const feeVault = lockupAccount.feeInfo.feeVault;

		const instruction = await this.getUnstakeInstruction(
			feeVault,
			rewardToken,
			stakeToken,
			staker,
			new BN(params.nonce.toString()),
		);

		return this._createPayload(staker, [instruction]);
	}

	async getLockupInfo(lockupAddress: Address): Promise<LockupInfo> {
		const lockupAccount = await this.program.account.lockup.fetchNullable(
			lockupAddress,
			this.provider.connection.commitment,
		);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;
		const rewardTokenAddress = lockupAccount.rewardToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.provider.connection, stakeTokenAddress);
		const rewardTokenDecimals = await getMintDecimals(this.provider.connection, rewardTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const UNITS_PER_REWARD_TOKEN = TEN_BIGNUM.pow(rewardTokenDecimals);

		return {
			feeInfo: {
				fee: BigNumber(lockupAccount.feeInfo.fee.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
				feeVault: lockupAccount.feeInfo.feeVault.toString(),
			},
			rewardToken: {
				tokenAddress: lockupAccount.rewardToken.tokenAddress.toString(),
			},
			stakeToken: {
				tokenAdress: lockupAccount.stakedToken.tokenAddress.toString(),
				totalStaked: BigNumber(lockupAccount.stakedToken.totalStaked.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
			},
			stakeInfo: {
				name: lockupAccount.stakeInfo.name,
				creator: lockupAccount.stakeInfo.creator.toString(),
				rewardSchemes: lockupAccount.stakeInfo.durationMap.map<RewardScheme>((value) => ({
					duration: value.duration.toNumber(),
					reward: BigNumber(value.reward.toString()).div(UNITS_PER_REWARD_TOKEN).toFixed(),
				})),
			},
		};
	}

	async getStakeInfo(lockupAddress: Address, stakeAddress: Address): Promise<StakeInfo> {
		const lockupAccount = await this.program.account.lockup.fetchNullable(
			lockupAddress,
			this.provider.connection.commitment,
		);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;
		const rewardTokenAddress = lockupAccount.rewardToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.provider.connection, stakeTokenAddress);
		const rewardTokenDecimals = await getMintDecimals(this.provider.connection, rewardTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const UNITS_PER_REWARD_TOKEN = TEN_BIGNUM.pow(rewardTokenDecimals);

		const stakeAccount = await this.program.account.userStakeData.fetchNullable(
			stakeAddress,
			this.provider.connection.commitment,
		);

		if (!stakeAccount) {
			throw new Error("Stake account does not exists for address: " + stakeAddress);
		}

		return {
			nonce: BigInt(stakeAccount.nonce.toString()),
			staker: stakeAccount.staker.toString(),
			createdTime: stakeAccount.createdTime.toNumber(),
			stakedAmount: BigNumber(stakeAccount.stakedAmount.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
			rewardAmount: BigNumber(stakeAccount.rewardAmount.toString()).div(UNITS_PER_REWARD_TOKEN).toFixed(),
			stakeClaimed: stakeAccount.stakeClaimed,
			lockPeriod: stakeAccount.lockPeriod.toNumber(),
		};
	}

	async getUserNonceInfo(userNonceAddress: Address): Promise<UserNonceInfo> {
		const userNonceAccount = await this.program.account.userNonce.fetchNullable(
			userNonceAddress,
			this.provider.connection.commitment,
		);

		if (!userNonceAccount) {
			throw new Error("User nonce account does not exists for address: " + userNonceAddress);
		}

		return {
			nonce: BigInt(userNonceAccount.nonce.toString()),
		};
	}
}

export type InitLockupInstructionData = {
	rewardSchemes: ParsedRewardScheme[];
	fee: BN;
	feeVault: PublicKey;
	name: string;
};

export type ParsedRewardScheme = {
	duration: BN;
	reward: BN;
};

type Numeric = string | number;

export type RewardScheme = {
	duration: number;
	reward: Numeric;
};

export type StakeInstructionData = {
	amount: BN;
	lockPeriod: BN;
	nonce: BN;
};

export type LockupInfo = {
	feeInfo: {
		fee: string;
		feeVault: string;
	};
	rewardToken: {
		tokenAddress: string;
	};
	stakeToken: {
		tokenAdress: string;
		totalStaked: string;
	};
	stakeInfo: {
		name: string;
		creator: string;
		rewardSchemes: RewardScheme[];
	};
};

export type StakeInfo = {
	nonce: bigint;
	staker: string;
	createdTime: number;
	stakedAmount: string;
	rewardAmount: string;
	stakeClaimed: boolean;
	lockPeriod: number;
};

export type UserNonceInfo = {
	nonce: bigint;
};
