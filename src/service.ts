import assert from "assert";
import { BigNumber } from "bignumber.js";

import { Address, AnchorProvider, BN, Program, Provider, translateAddress } from "@coral-xyz/anchor";
import {
	AddressLookupTableAccount,
	clusterApiUrl,
	Connection,
	Finality,
	PublicKey,
	Signer,
	TransactionInstruction,
} from "@solana/web3.js";
import { bpsToPercent, percentToBps } from "@zebec-network/core-utils";
import {
	getAssociatedTokenAddressSync,
	getMintDecimals,
	SignTransactionFunction,
	TransactionPayload,
} from "@zebec-network/solana-common";

import { ZEBEC_STAKE_IDL_V1, ZebecStakeIdlV1 } from "./artifacts";
import { TEN_BIGNUM } from "./constants";
import {
	deriveLockupAddress,
	deriveRewardVaultAddress,
	deriveStakeAddress,
	deriveStakeVaultAddress,
	deriveUserNonceAddress,
} from "./pda";
import { createReadonlyProvider, ReadonlyProvider } from "./providers";
import { RateLimitedQueue } from "./rateLimitQueue";
import { callWithEnhancedBackoff, chunkArray } from "./utils";

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
			this.connection,
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
				minimumStake: data.minimumStake,
			})
			.accountsPartial({
				creator,
				lockup,
				rewardToken,
				rewardVault,
				stakeToken,
				stakeVault,
			})
			.instruction();
	}

	async getStakeInstruction(
		lockup: PublicKey,
		stakeToken: PublicKey,
		stakeVault: PublicKey,
		staker: PublicKey,
		userNonce: PublicKey,
		stakePda: PublicKey,
		stakeVaultTokenAccount: PublicKey,
		data: StakeInstructionData,
	): Promise<TransactionInstruction> {
		return this.program.methods
			.stakeZbcn(data)
			.accountsPartial({ stakeToken, staker, lockup, stakeVault, userNonce, stakePda, stakeVaultTokenAccount })
			.instruction();
	}

	async getUnstakeInstruction(
		feeVault: PublicKey,
		lockup: PublicKey,
		stakePda: PublicKey,
		rewardToken: PublicKey,
		rewardVault: PublicKey,
		stakeToken: PublicKey,
		stakeVault: PublicKey,
		staker: PublicKey,
		stakerTokenAccount: PublicKey,
		nonce: BN,
	): Promise<TransactionInstruction> {
		return this.program.methods
			.unstakeZbcn(nonce)
			.accountsPartial({
				feeVault,
				rewardToken,
				stakeToken,
				staker,
				lockup,
				stakeVault,
				stakePda,
				rewardVault,
				stakerTokenAccount,
			})
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
		minimumStake: Numeric;
	}): Promise<TransactionPayload> {
		const creator = params.creator ? translateAddress(params.creator) : this.provider.publicKey;

		if (!creator) {
			throw new Error("MissingArgument: Please provide either creator address or publicKey in provider");
		}
		const stakeToken = translateAddress(params.stakeToken);
		const rewardToken = translateAddress(params.rewardToken);
		const feeVault = translateAddress(params.feeVault);

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeToken);
		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const rewardSchemes = params.rewardSchemes.map<ParsedRewardScheme>((value) => {
			return {
				duration: new BN(value.duration),
				reward: new BN(percentToBps(value.rewardRate)),
			};
		});

		const lockup = deriveLockupAddress(params.name, this.programId);
		const rewardVault = deriveRewardVaultAddress(lockup, this.programId);
		const stakeVault = deriveStakeVaultAddress(lockup, this.programId);

		const fee = new BN(BigNumber(params.fee).times(UNITS_PER_STAKE_TOKEN).toFixed(0));
		const minimumStake = new BN(BigNumber(params.minimumStake).times(UNITS_PER_STAKE_TOKEN).toFixed(0));

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
				minimumStake,
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

		const lockup = deriveLockupAddress(params.lockupName, this.programId);

		const lockupAccount = await this.program.account.lockup.fetchNullable(lockup, this.connection.commitment);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockup);
		}

		const lockPeriods = lockupAccount.stakeInfo.durationMap.map((item) => item.duration.toNumber());
		if (!lockPeriods.includes(params.lockPeriod)) {
			throw new Error(
				"Invalid lockperiod. Available options are: " + lockPeriods.map((l) => l.toString()).concat(", "),
			);
		}

		const stakeToken = lockupAccount.stakedToken.tokenAddress;
		const stakeVault = deriveStakeVaultAddress(lockup, this.programId);
		const userNonce = deriveUserNonceAddress(staker, lockup, this.programId);

		const userNonceAccount = await this.program.account.userNonce.fetchNullable(userNonce, this.connection.commitment);

		let nonce = BigInt(0);
		if (userNonceAccount) {
			nonce = BigInt(userNonceAccount.nonce.toString());
		}

		const stakePda = deriveStakeAddress(staker, lockup, nonce, this.programId);
		const stakeVaultTokenAccount = getAssociatedTokenAddressSync(stakeToken, stakeVault, true);

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeToken);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);

		const instruction = await this.getStakeInstruction(
			lockup,
			stakeToken,
			stakeVault,
			staker,
			userNonce,
			stakePda,
			stakeVaultTokenAccount,
			{
				amount: new BN(BigNumber(params.amount).times(UNITS_PER_STAKE_TOKEN).toFixed(0)),
				lockPeriod: new BN(params.lockPeriod),
				nonce: new BN(params.nonce.toString()),
			},
		);

		return this._createPayload(staker, [instruction]);
	}

	async unstake(params: { lockupName: string; nonce: bigint; staker?: Address }): Promise<TransactionPayload> {
		const staker = params.staker ? translateAddress(params.staker) : this.provider.publicKey;

		if (!staker) {
			throw new Error("MissingArgument: Please provide either staker address or publicKey in provider");
		}

		const lockup = deriveLockupAddress(params.lockupName, this.programId);

		const lockupAccount = await this.program.account.lockup.fetchNullable(lockup, this.connection.commitment);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockup);
		}

		const stakeToken = lockupAccount.stakedToken.tokenAddress;
		const rewardToken = lockupAccount.rewardToken.tokenAddress;
		const feeVault = lockupAccount.feeInfo.feeVault;

		const stakePda = deriveStakeAddress(staker, lockup, params.nonce, this.programId);
		const rewardVault = deriveRewardVaultAddress(lockup, this.programId);
		const stakeVault = deriveStakeVaultAddress(lockup, this.programId);

		const stakerTokenAccount = getAssociatedTokenAddressSync(stakeToken, staker, true);

		const instruction = await this.getUnstakeInstruction(
			feeVault,
			lockup,
			stakePda,
			rewardToken,
			rewardVault,
			stakeToken,
			stakeVault,
			staker,
			stakerTokenAccount,
			new BN(params.nonce.toString()),
		);

		return this._createPayload(staker, [instruction]);
	}

	async getLockupInfo(lockupAddress: Address): Promise<LockupInfo | null> {
		const lockupAccount = await this.program.account.lockup.fetchNullable(lockupAddress, this.connection.commitment);

		if (!lockupAccount) {
			return null;
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);

		return {
			address: lockupAddress.toString(),
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
					rewardRate: bpsToPercent(value.reward.toString()),
				})),
				minimumStake: BigNumber(lockupAccount.stakeInfo.minimumStake.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
			},
		};
	}

	async getStakeInfo(stakeAddress: Address, lockupAddress: Address): Promise<StakeInfo | null> {
		const lockupAccount = await this.program.account.lockup.fetchNullable(lockupAddress, this.connection.commitment);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;
		const rewardTokenAddress = lockupAccount.rewardToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeTokenAddress);
		const rewardTokenDecimals = await getMintDecimals(this.connection, rewardTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const UNITS_PER_REWARD_TOKEN = TEN_BIGNUM.pow(rewardTokenDecimals);

		const stakeAccount = await this.program.account.userStakeData.fetchNullable(
			stakeAddress,
			this.connection.commitment,
		);

		if (!stakeAccount) {
			return null;
		}

		return {
			address: stakeAddress.toString(),
			nonce: BigInt(stakeAccount.nonce.toString()),
			createdTime: stakeAccount.createdTime.toNumber(),
			stakedAmount: BigNumber(stakeAccount.stakedAmount.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
			rewardAmount: BigNumber(stakeAccount.rewardAmount.toString()).div(UNITS_PER_REWARD_TOKEN).toFixed(),
			stakeClaimed: stakeAccount.stakeClaimed,
			lockPeriod: stakeAccount.lockPeriod.toNumber(),
			lockup: stakeAccount.lockup.toString(),
			staker: stakeAccount.staker.toString(),
		};
	}

	async getUserNonceInfo(userNonceAddress: Address): Promise<UserNonceInfo | null> {
		const userNonceAccount = await this.program.account.userNonce.fetchNullable(
			userNonceAddress,
			this.connection.commitment,
		);

		if (!userNonceAccount) {
			return null;
		}

		return {
			address: userNonceAddress.toString(),
			nonce: BigInt(userNonceAccount.nonce.toString()),
		};
	}

	async getAllStakesInfoOfUser(
		userAdress: Address,
		lockupAddress: Address,
		options: {
			minDelayMs?: number;
			maxConcurrent?: number;
		} = {},
	) {
		const lockupAccount = await this.program.account.lockup.fetchNullable(lockupAddress, this.connection.commitment);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;
		const rewardTokenAddress = lockupAccount.rewardToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeTokenAddress);
		const rewardTokenDecimals = await getMintDecimals(this.connection, rewardTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const UNITS_PER_REWARD_TOKEN = TEN_BIGNUM.pow(rewardTokenDecimals);

		const userNonceAddress = deriveUserNonceAddress(userAdress, lockupAddress, this.programId);
		const userNonceAccount = await this.program.account.userNonce.fetchNullable(
			userNonceAddress,
			this.connection.commitment,
		);

		if (!userNonceAccount) {
			return [];
		}

		const currentNonce = userNonceAccount.nonce.toNumber();

		const nonces = Array.from({ length: currentNonce }, (_, i) => BigInt(i));

		const stakeAddresses = nonces.map((nonce) => deriveStakeAddress(userAdress, lockupAddress, nonce, this.programId));

		const stakeAddressesChunks = chunkArray(stakeAddresses, 100);

		let stakeWithHash2D: StakeInfoWithHash[][] = [];

		for (const stakeAddresses of stakeAddressesChunks) {
			const accountInfos = await this.connection.getMultipleAccountsInfo(stakeAddresses, {
				commitment: this.connection.commitment,
			});

			const stakeAccountsInfo = accountInfos.map((value, i) => {
				assert(value, "Account does not exists for stake address: " + stakeAddresses[i] + " at nonce: " + nonces[i]);
				const stakeAccount = this.program.coder.accounts.decode(this.program.idl.accounts[2].name, value.data);
				const info: StakeInfo = {
					address: stakeAddresses[i].toString(),
					nonce: BigInt(stakeAccount.nonce.toString()),
					createdTime: stakeAccount.createdTime.toNumber(),
					stakedAmount: BigNumber(stakeAccount.stakedAmount.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
					rewardAmount: BigNumber(stakeAccount.rewardAmount.toString()).div(UNITS_PER_REWARD_TOKEN).toFixed(),
					stakeClaimed: stakeAccount.stakeClaimed,
					lockPeriod: stakeAccount.lockPeriod.toNumber(),
					lockup: stakeAccount.lockup.toString(),
					staker: stakeAccount.staker.toString(),
				};

				return info;
			});

			let stakesWithHash: StakeInfoWithHash[] = new Array(stakeAccountsInfo.length);

			const { maxConcurrent = 3, minDelayMs = 400 } = options;
			const queue = new RateLimitedQueue(maxConcurrent, minDelayMs); // Max 3 concurrent, 300ms between requests

			const promises = stakeAccountsInfo.map((stakeInfo, index) =>
				queue.add(async () => {
					const signature = await this.getStakeSignatureForStake(stakeInfo);
					stakesWithHash[index] = {
						hash: signature ? signature : "",
						...stakeInfo,
					};
				}),
			);

			await Promise.all(promises);

			stakeWithHash2D.push(stakesWithHash);
		}

		return stakeWithHash2D.flat();
	}

	async getAllStakesCount(lockupAddress: Address) {
		const dataSize = this.program.account.userStakeData.size;

		const accountInfos = await this.connection.getProgramAccounts(this.programId, {
			commitment: this.connection.commitment,
			dataSlice: {
				length: 0,
				offset: 0,
			},
			filters: [
				{
					dataSize,
				},
				{
					memcmp: {
						bytes: lockupAddress.toString(),
						offset: 81,
					},
				},
			],
		});

		return accountInfos.length;
	}

	async getStakeSignatureForStake(stakeInfo: StakeInfo) {
		const commitment: Finality = this.connection.commitment === "finalized" ? "finalized" : "confirmed";

		const signatures = await callWithEnhancedBackoff(async () =>
			this.connection.getSignaturesForAddress(translateAddress(stakeInfo.address), {}, commitment),
		);

		const stakeSignatures = signatures.filter((s) => {
			return !s.err && (s.blockTime ?? 0) === stakeInfo.createdTime;
		});

		const signatureInfo = stakeSignatures[stakeSignatures.length - 1];

		return signatureInfo ? signatureInfo.signature : null;
	}

	async getAllStakesInfo(lockupAddress: Address) {
		const lockupAccount = await this.program.account.lockup.fetchNullable(lockupAddress, this.connection.commitment);

		if (!lockupAccount) {
			throw new Error("Lockup account does not exists for address: " + lockupAddress);
		}

		const stakeTokenAddress = lockupAccount.stakedToken.tokenAddress;
		const rewardTokenAddress = lockupAccount.rewardToken.tokenAddress;

		const stakeTokenDecimals = await getMintDecimals(this.connection, stakeTokenAddress);
		const rewardTokenDecimals = await getMintDecimals(this.connection, rewardTokenAddress);

		const UNITS_PER_STAKE_TOKEN = TEN_BIGNUM.pow(stakeTokenDecimals);
		const UNITS_PER_REWARD_TOKEN = TEN_BIGNUM.pow(rewardTokenDecimals);

		const dataSize = this.program.account.userStakeData.size;

		const accountInfos = await this.connection.getProgramAccounts(this.programId, {
			commitment: "finalized",
			filters: [
				{
					dataSize,
				},
				{
					memcmp: {
						bytes: lockupAddress.toString(),
						offset: 81,
					},
				},
			],
		});

		return accountInfos.map((accountInfo) => {
			const stakeAccount = this.program.coder.accounts.decode(
				this.program.idl.accounts[2].name,
				accountInfo.account.data,
			);
			const info: StakeInfo = {
				address: accountInfo.pubkey.toString(),
				nonce: BigInt(stakeAccount.nonce.toString()),
				createdTime: stakeAccount.createdTime.toNumber(),
				stakedAmount: BigNumber(stakeAccount.stakedAmount.toString()).div(UNITS_PER_STAKE_TOKEN).toFixed(),
				rewardAmount: BigNumber(stakeAccount.rewardAmount.toString()).div(UNITS_PER_REWARD_TOKEN).toFixed(),
				stakeClaimed: stakeAccount.stakeClaimed,
				lockPeriod: stakeAccount.lockPeriod.toNumber(),
				lockup: stakeAccount.lockup.toString(),
				staker: stakeAccount.staker.toString(),
			};

			return info;
		});
	}

	get programId(): PublicKey {
		return this.program.programId;
	}

	get connection(): Connection {
		return this.provider.connection;
	}
}

export type InitLockupInstructionData = {
	rewardSchemes: ParsedRewardScheme[];
	fee: BN;
	feeVault: PublicKey;
	name: string;
	minimumStake: BN;
};

export type ParsedRewardScheme = {
	duration: BN;
	reward: BN;
};

type Numeric = string | number;

export type RewardScheme = {
	duration: number;
	rewardRate: Numeric;
};

export type StakeInstructionData = {
	amount: BN;
	lockPeriod: BN;
	nonce: BN;
};

export type LockupInfo = {
	address: string;
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
		minimumStake: string;
	};
};

export type StakeInfo = {
	address: string;
	nonce: bigint;
	createdTime: number;
	stakedAmount: string;
	rewardAmount: string;
	stakeClaimed: boolean;
	lockPeriod: number;
	staker: string;
	lockup: string;
};

export type UserNonceInfo = {
	address: string;
	nonce: bigint;
};

export type StakeInfoWithHash = StakeInfo & {
	hash: string;
};
