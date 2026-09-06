# Zebec Stake Sdk

An SDK for interacting with the Zebec Network staking program on Solana. Supports creating and managing staking lockup pools, staking/unstaking tokens, and querying on-chain staking data.

## Table of Contents

- [Installation](#installation)
- [Quick Setup](#quick-setup)
- [API Documentation](#api-documentation)
  - [StakeServiceBuilder](#stakeservicebuilder)
  - [StakeService](#stakeservice)
  - [Providers](#providers)
  - [PDA Utilities](#pda-utilities)
  - [Types](#types)
  - [Constants](#constants)
  - [RateLimitedQueue](#ratelimitedqueue)
- [Usage Examples](#usage-examples)
  - [Read-only queries](#read-only-queries)
  - [Initialize a lockup pool](#initialize-a-lockup-pool)
  - [Update a lockup pool](#update-a-lockup-pool)
  - [Stake tokens](#stake-tokens)
  - [Unstake tokens](#unstake-tokens)
  - [Fetch stake data](#fetch-stake-data)
- [Development](#development)

---

## Installation

```bash
npm install @zebec-network/zebec-stake-sdk
```

```bash
yarn add @zebec-network/zebec-stake-sdk
```

```bash
pnpm add @zebec-network/zebec-stake-sdk
```

---

## Quick Setup

### Read-only (no wallet required)

Use this setup for querying on-chain data without signing transactions.

```ts
import { Connection } from "@solana/web3.js";
import { createReadonlyProvider, StakeServiceBuilder } from "@zebec-network/zebec-stake-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const provider = createReadonlyProvider(connection);

const service = new StakeServiceBuilder()
  .setNetwork("mainnet-beta")
  .setProvider(provider)
  .setProgram()
  .build();
```

### With wallet (for signing transactions)

Use this setup when you need to send transactions (stake, unstake, create/update lockups).

```ts
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import {
  createAnchorProvider,
  StakeServiceBuilder,
} from "@zebec-network/zebec-stake-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const keypair = Keypair.fromSecretKey(/* your secret key bytes */);
const wallet = new Wallet(keypair);

const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

const service = new StakeServiceBuilder()
  .setNetwork("mainnet-beta")
  .setProvider(provider)
  .setProgram()
  .build();
```

### Default setup (mainnet, no wallet)

All builder methods are optional — calling them without arguments uses sensible defaults.

```ts
import { StakeServiceBuilder } from "@zebec-network/zebec-stake-sdk";

// Defaults: mainnet-beta network, ReadonlyProvider with public RPC
const service = new StakeServiceBuilder()
  .setNetwork()
  .setProvider()
  .setProgram()
  .build();
```

---

## API Documentation

### StakeServiceBuilder

A fluent builder for constructing a `StakeService`. Methods must be called in order: `setNetwork` → `setProvider` → `setProgram` → `build`.

```ts
class StakeServiceBuilder {
  setNetwork(network?: "mainnet-beta" | "devnet"): StakeServiceBuilder
  setProvider(provider?: ReadonlyProvider | AnchorProvider): StakeServiceBuilder
  setProgram(createProgram?: (provider) => Program<ZebecStakeIdlV1>): StakeServiceBuilder
  build(): StakeService
}
```

| Method | Description |
| ------ | ----------- |
| `setNetwork(network?)` | Set the target network. Defaults to `"mainnet-beta"`. Must be called before `setProvider`. |
| `setProvider(provider?)` | Set the provider. Accepts `ReadonlyProvider` or `AnchorProvider`. Defaults to `ReadonlyProvider` using the public cluster RPC. Must be called before `setProgram`. |
| `setProgram(createProgram?)` | Set the Anchor program. Optionally accepts a factory `(provider) => Program`. Defaults to the built-in IDL. |
| `build()` | Validates all settings and returns a `StakeService` instance. Throws if any step was skipped. |

**Errors thrown by the builder:**

- `"InvalidOperation: Network is set twice."` — `setNetwork` called more than once.
- `"InvalidOperation: Provider is set twice."` — `setProvider` called more than once.
- `"InvalidOperation: Program is set twice."` — `setProgram` called more than once.
- `"InvalidOperation: Network is not set."` — `setProvider`/`setProgram` called before `setNetwork`.
- `"InvalidOperation: Provider is not set."` — `setProgram` called before `setProvider`.
- Network mismatch error if the provider's RPC endpoint does not match the set network.

---

### StakeService

The main service class. Exposes methods for managing lockup pools, staking, and reading on-chain data. All transaction methods return a `TransactionPayload` that must be executed separately.

#### `initLockup(params)`

Creates a new staking lockup pool. Only the `creator` can later update it.

```ts
service.initLockup(params: {
  stakeToken: Address;       // Mint address of the token to be staked
  rewardToken: Address;      // Mint address of the reward token
  name: string;              // Unique name for the lockup (used to derive its address)
  fee: Numeric;              // Fee amount per stake (in token units, e.g. 5 = 5 tokens)
  feeVault: Address;         // Public key of the account that collects fees
  rewardSchemes: RewardScheme[]; // Array of lock durations and annual reward rates
  minimumStake: Numeric;     // Minimum stake amount (in token units)
  creator?: Address;         // Defaults to provider.publicKey
}): Promise<TransactionPayload>
```

#### `updateLockup(params)`

Updates an existing lockup pool. Only callable by the original creator.

```ts
service.updateLockup(params: {
  lockupName: string;        // Name of the lockup to update
  fee: Numeric;              // New fee amount
  feeVault: Address;         // New fee vault address
  rewardSchemes: RewardScheme[]; // Updated reward schemes
  minimumStake: Numeric;     // Updated minimum stake amount
  updater?: Address;         // Defaults to provider.publicKey
}): Promise<TransactionPayload>
```

#### `stake(params)`

Stakes tokens into a lockup pool for a specified lock period.

```ts
service.stake(params: {
  lockupName: string;        // Name of the lockup to stake into
  amount: Numeric;           // Amount to stake (in token units, e.g. 100 = 100 tokens)
  lockPeriod: number;        // Lock duration in seconds — must match an existing reward scheme
  nonce: bigint;             // Current user nonce (use getUserNonceInfo to retrieve)
  feePayer?: Address;        // Defaults to staker
  staker?: Address;          // Defaults to provider.publicKey
}): Promise<TransactionPayload>
```

#### `unstake(params)`

Unstakes tokens and claims the accrued reward after the lock period has elapsed.

```ts
service.unstake(params: {
  lockupName: string;        // Name of the lockup
  nonce: bigint;             // Nonce of the stake to unstake
  feePayer?: Address;        // Defaults to staker
  staker?: Address;          // Defaults to provider.publicKey
}): Promise<TransactionPayload>
```

#### `getLockupInfo(lockupAddress)`

Fetches and returns human-readable information about a lockup pool.

```ts
service.getLockupInfo(lockupAddress: Address): Promise<LockupInfo | null>
```

Returns `null` if the lockup does not exist.

#### `getStakeInfo(stakeAddress, lockupAddress)`

Fetches information about a specific stake position.

```ts
service.getStakeInfo(stakeAddress: Address, lockupAddress: Address): Promise<StakeInfo | null>
```

Returns `null` if the stake account does not exist. Throws if the lockup does not exist.

#### `getUserNonceInfo(userNonceAddress)`

Returns the user's current nonce for a given lockup. The nonce is used to derive stake addresses and must be passed when calling `stake()`.

```ts
service.getUserNonceInfo(userNonceAddress: Address): Promise<UserNonceInfo | null>
```

Returns `null` if the user has never staked in this lockup (nonce is implicitly `0n`).

#### `getAllStakesInfoOfUser(userAddress, lockupAddress, options?)`

Fetches all historical stake positions for a user in a given lockup pool, including the transaction signature for each stake.

```ts
service.getAllStakesInfoOfUser(
  userAddress: Address,
  lockupAddress: Address,
  options?: {
    minDelayMs?: number;    // Minimum ms between RPC calls (default: 400)
    maxConcurrent?: number; // Max concurrent RPC calls (default: 3)
  }
): Promise<StakeInfoWithHash[]>
```

#### `getAllStakesInfo(lockupAddress)`

Fetches all stake positions across all users in a lockup pool.

```ts
service.getAllStakesInfo(lockupAddress: Address): Promise<StakeInfo[]>
```

#### `getAllStakesCount(lockupAddress)`

Returns the total number of stake accounts associated with a lockup pool.

```ts
service.getAllStakesCount(lockupAddress: Address): Promise<number>
```

#### `getStakeSignatureForStake(stakeInfo)`

Retrieves the on-chain transaction signature for a given stake position.

```ts
service.getStakeSignatureForStake(stakeInfo: StakeInfo): Promise<string | null>
```

#### Instruction Builders

These methods return raw `TransactionInstruction` objects for advanced use cases where you need to compose transactions manually (e.g., bundling multiple instructions into a single transaction).

#### `getInitLockupInstruction(creator, lockup, stakeToken, rewardToken, rewardVault, stakeVault, data)`

Returns the instruction for initializing a lockup pool.

```ts
service.getInitLockupInstruction(
  creator: PublicKey,
  lockup: PublicKey,
  stakeToken: PublicKey,
  rewardToken: PublicKey,
  rewardVault: PublicKey,
  stakeVault: PublicKey,
  data: InitLockupInstructionData
): Promise<TransactionInstruction>
```

#### `getUpdateLockupInstruction(updater, lockup, data)`

Returns the instruction for updating a lockup pool.

```ts
service.getUpdateLockupInstruction(
  updater: PublicKey,
  lockup: PublicKey,
  data: UpdateLockupInstructionData
): Promise<TransactionInstruction>
```

#### `getStakeInstruction(feePayer, lockup, stakeToken, stakeVault, staker, userNonce, stakePda, stakeVaultTokenAccount, data)`

Returns the instruction for staking tokens.

```ts
service.getStakeInstruction(
  feePayer: PublicKey,
  lockup: PublicKey,
  stakeToken: PublicKey,
  stakeVault: PublicKey,
  staker: PublicKey,
  userNonce: PublicKey,
  stakePda: PublicKey,
  stakeVaultTokenAccount: PublicKey,
  data: StakeInstructionData
): Promise<TransactionInstruction>
```

#### `getUnstakeInstruction(feePayer, feeVault, lockup, stakePda, rewardToken, rewardVault, stakeToken, stakeVault, staker, stakerTokenAccount, nonce)`

Returns the instruction for unstaking tokens.

```ts
service.getUnstakeInstruction(
  feePayer: PublicKey,
  feeVault: PublicKey,
  lockup: PublicKey,
  stakePda: PublicKey,
  rewardToken: PublicKey,
  rewardVault: PublicKey,
  stakeToken: PublicKey,
  stakeVault: PublicKey,
  staker: PublicKey,
  stakerTokenAccount: PublicKey,
  nonce: BN
): Promise<TransactionInstruction>
```

#### Properties

| Property | Type | Description |
| -------- | ---- | ----------- |
| `programId` | `PublicKey` | The deployed staking program's public key |
| `connection` | `Connection` | The active Solana RPC connection |
| `provider` | `Provider` | The underlying Anchor/Readonly provider |
| `program` | `Program<ZebecStakeIdlV1>` | The Anchor program instance |

---

### Providers

Two provider types are available depending on your use case.

#### `createReadonlyProvider(connection, walletAddress?)`

Creates a lightweight provider for read-only operations. Does not require a wallet.

```ts
import { createReadonlyProvider } from "@zebec-network/zebec-stake-sdk";

const provider = createReadonlyProvider(connection);
// or with an optional wallet address for context
const provider = createReadonlyProvider(connection, "YourWalletPublicKey...");
```

#### `createAnchorProvider(connection, wallet, options?)`

Creates a full Anchor provider capable of signing and sending transactions.

```ts
import { createAnchorProvider } from "@zebec-network/zebec-stake-sdk";

const provider = createAnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
```

The `wallet` must implement the `AnchorWallet` interface:

```ts
interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}
```

---

### PDA Utilities

Helper functions for deriving program-derived addresses. All `programId` parameters default to the mainnet program ID.

```ts
import {
  deriveLockupAddress,
  deriveStakeAddress,
  deriveUserNonceAddress,
  deriveStakeVaultAddress,
  deriveRewardVaultAddress,
} from "@zebec-network/zebec-stake-sdk";
```

| Function | Description |
| -------- | ----------- |
| `deriveLockupAddress(name, programId?)` | Derives the lockup PDA from its unique name |
| `deriveStakeAddress(staker, lockup, nonce, programId?)` | Derives a stake PDA for a given staker, lockup, and nonce |
| `deriveUserNonceAddress(user, lockup, programId?)` | Derives the user nonce PDA tracking a user's total stake count |
| `deriveStakeVaultAddress(lockup, programId?)` | Derives the vault PDA that holds staked tokens |
| `deriveRewardVaultAddress(lockup, programId?)` | Derives the vault PDA that holds reward tokens |

---

### Types

```ts
// Human-readable reward scheme: duration in seconds and annual rate as a percentage
type RewardScheme = {
  duration: number;       // Lock period in seconds (e.g., 2592000 = 30 days)
  rewardRate: Numeric;    // Annual reward rate as a percentage (e.g., "5.00" = 5%)
};

// On-chain representation of a reward scheme (used with instruction builders)
type ParsedRewardScheme = {
  duration: BN;           // Lock period as a BN
  reward: BN;             // Reward rate in basis points
};

// Returned by getLockupInfo()
type LockupInfo = {
  address: string;
  feeInfo: {
    fee: string;           // Fee amount in token units
    feeVault: string;      // Fee collector address
  };
  rewardToken: {
    tokenAddress: string;
  };
  stakeToken: {
    tokenAdress: string;   // Note: single 'd' in 'adress' (matches on-chain field)
    totalStaked: string;   // Total tokens currently staked in this lockup
  };
  stakeInfo: {
    name: string;
    creator: string;
    rewardSchemes: RewardScheme[];
    minimumStake: string;
  };
};

// Returned by getStakeInfo() and getAllStakesInfo()
type StakeInfo = {
  address: string;         // Stake PDA address
  nonce: bigint;           // Stake nonce (index within this user's stakes)
  createdTime: number;     // Unix timestamp of when the stake was created
  stakedAmount: string;    // Amount staked in token units
  rewardAmount: string;    // Accrued reward in reward token units
  stakeClaimed: boolean;   // Whether the stake has been unstaked
  lockPeriod: number;      // Lock duration in seconds
  staker: string;          // Staker's public key
  lockup: string;          // Lockup PDA address
};

// Returned by getAllStakesInfoOfUser()
type StakeInfoWithHash = StakeInfo & {
  hash: string;            // Transaction signature of the original stake
};

// Returned by getUserNonceInfo()
type UserNonceInfo = {
  address: string;         // User nonce PDA address
  nonce: bigint;           // Current nonce (equals total number of stakes made)
};

// Accepted wherever amounts are passed
type Numeric = string | number;

// Data for getInitLockupInstruction()
type InitLockupInstructionData = {
  rewardSchemes: ParsedRewardScheme[];
  fee: BN;
  feeVault: PublicKey;
  name: string;
  minimumStake: BN;
};

// Data for getUpdateLockupInstruction()
type UpdateLockupInstructionData = {
  rewardSchemes: ParsedRewardScheme[];
  fee: BN;
  feeVault: PublicKey;
  minimumStake: BN;
};

// Data for getStakeInstruction()
type StakeInstructionData = {
  amount: BN;
  lockPeriod: BN;
  nonce: BN;
};
```

---

### Constants

```ts
import { ZEBEC_STAKE_PROGRAM, STAKE_LOOKUP_TABLE_ADDRESS } from "@zebec-network/zebec-stake-sdk";

// Program IDs
ZEBEC_STAKE_PROGRAM.mainnet  // "zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv"
ZEBEC_STAKE_PROGRAM.devnet   // "zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv"

// Address Lookup Table accounts for versioned transactions
STAKE_LOOKUP_TABLE_ADDRESS["mainnet-beta"]  // "EoKjJejKr4XsBdtUuYwzZcYd6tpGNijxCGgQocxtxQ8t"
STAKE_LOOKUP_TABLE_ADDRESS["devnet"]        // "C4R2sL6yj7bzKfbdfwCfH68DZZ3QnzdmedE9wQqTfAAA"
```

---

### RateLimitedQueue

A utility class for rate-limiting concurrent async operations. Used internally by `getAllStakesInfoOfUser` but also exported for advanced use cases.

```ts
import { RateLimitedQueue } from "@zebec-network/zebec-stake-sdk";

const queue = new RateLimitedQueue(maxConcurrent = 3, minDelayMs = 200);

const result = await queue.add(async () => {
  // Your async operation
  return await fetchSomething();
});
```

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `maxConcurrent` | `3` | Maximum number of concurrent operations |
| `minDelayMs` | `200` | Minimum delay in milliseconds between requests |

---

## Usage Examples

### Read-only queries

```ts
import { Connection } from "@solana/web3.js";
import {
  createReadonlyProvider,
  deriveLockupAddress,
  deriveUserNonceAddress,
  StakeServiceBuilder,
} from "@zebec-network/zebec-stake-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const provider = createReadonlyProvider(connection);

const service = new StakeServiceBuilder()
  .setNetwork("mainnet-beta")
  .setProvider(provider)
  .setProgram()
  .build();

// Derive the lockup address from its name
const lockupName = "ZBCN_Lockup_003";
const lockupAddress = deriveLockupAddress(lockupName, service.programId);

// Fetch lockup pool info
const lockupInfo = await service.getLockupInfo(lockupAddress);
console.log(lockupInfo);
// {
//   address: "...",
//   feeInfo: { fee: "5", feeVault: "..." },
//   rewardToken: { tokenAddress: "..." },
//   stakeToken: { tokenAdress: "...", totalStaked: "1234567" },
//   stakeInfo: {
//     name: "ZBCN_Lockup_003",
//     creator: "...",
//     rewardSchemes: [
//       { duration: 2592000, rewardRate: "3.00" },
//       { duration: 7776000, rewardRate: "5.00" },
//     ],
//     minimumStake: "1"
//   }
// }

// Fetch all stakes in a lockup
const allStakes = await service.getAllStakesInfo(lockupAddress);
console.log(`Total active positions: ${allStakes.length}`);

// Fetch total stake count
const count = await service.getAllStakesCount(lockupAddress);
console.log(`Total stake accounts: ${count}`);
```

### Initialize a lockup pool

Requires an `AnchorProvider` (wallet with signing capability).

```ts
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import {
  createAnchorProvider,
  deriveLockupAddress,
  StakeServiceBuilder,
} from "@zebec-network/zebec-stake-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const keypair = Keypair.fromSecretKey(/* your secret key bytes */);
const wallet = new Wallet(keypair);
const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

const service = new StakeServiceBuilder()
  .setNetwork("devnet")
  .setProvider(provider)
  .setProgram()
  .build();

const ZBCN_MINT = "ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU";

const payload = await service.initLockup({
  stakeToken: ZBCN_MINT,
  rewardToken: ZBCN_MINT,
  name: "My_Lockup_001",
  fee: 0,                        // 0 token fee per stake
  feeVault: "FeeVaultPublicKey...",
  minimumStake: 1,               // Minimum 1 token to stake
  rewardSchemes: [
    { duration: 2592000, rewardRate: "3.00" },  // 30 days @ 3% APR
    { duration: 7776000, rewardRate: "5.00" },  // 90 days @ 5% APR
    { duration: 15552000, rewardRate: "7.00" }, // 180 days @ 7% APR
  ],
});

const signature = await payload.execute({ commitment: "confirmed" });
console.log("Lockup created:", signature);

const lockupAddress = deriveLockupAddress("My_Lockup_001", service.programId);
const lockupInfo = await service.getLockupInfo(lockupAddress);
console.log(lockupInfo);
```

### Update a lockup pool

Only the original creator can update a lockup.

```ts
const payload = await service.updateLockup({
  lockupName: "My_Lockup_001",
  fee: 5,
  feeVault: "NewFeeVaultPublicKey...",
  minimumStake: 10,
  rewardSchemes: [
    { duration: 2592000, rewardRate: "5.00" },  // 30 days @ 5% APR
    { duration: 7776000, rewardRate: "8.00" },  // 90 days @ 8% APR
    { duration: 15552000, rewardRate: "12.00" }, // 180 days @ 12% APR
  ],
});

const signature = await payload.execute({ commitment: "confirmed" });
console.log("Lockup updated:", signature);
```

### Stake tokens

```ts
import {
  deriveUserNonceAddress,
  deriveLockupAddress,
} from "@zebec-network/zebec-stake-sdk";

const lockupName = "My_Lockup_001";
const lockupAddress = deriveLockupAddress(lockupName, service.programId);

// Get the user's current nonce (determines the next stake account address)
const userNonceAddress = deriveUserNonceAddress(
  wallet.publicKey,
  lockupAddress,
  service.programId,
);
const nonceInfo = await service.getUserNonceInfo(userNonceAddress);
const nonce = nonceInfo ? nonceInfo.nonce : 0n;

// Stake 1000 tokens for 30 days (2592000 seconds)
const payload = await service.stake({
  lockupName,
  amount: 1000,
  lockPeriod: 2592000, // must match a duration in the lockup's rewardSchemes
  nonce,               // current nonce; incremented on-chain after staking
});

const signature = await payload.execute({ commitment: "confirmed" });
console.log("Stake signature:", signature);
```

### Unstake tokens

Unstaking returns the original staked tokens plus any accrued reward. Can only be called after the lock period has elapsed.

```ts
import { deriveStakeAddress } from "@zebec-network/zebec-stake-sdk";

// The nonce used when staking identifies which stake position to unstake
const stakeNonce = 0n;

const payload = await service.unstake({
  lockupName: "My_Lockup_001",
  nonce: stakeNonce,
});

const signature = await payload.execute({ commitment: "confirmed" });
console.log("Unstake signature:", signature);

// Verify the stake was claimed
const lockupAddress = deriveLockupAddress("My_Lockup_001", service.programId);
const stakeAddress = deriveStakeAddress(
  wallet.publicKey,
  lockupAddress,
  stakeNonce,
  service.programId,
);
const stakeInfo = await service.getStakeInfo(stakeAddress, lockupAddress);
console.log("Stake claimed:", stakeInfo?.stakeClaimed); // true
console.log("Reward received:", stakeInfo?.rewardAmount);
```

### Fetch stake data

```ts
// All stakes for a specific user in a lockup
const userStakes = await service.getAllStakesInfoOfUser(
  wallet.publicKey,
  lockupAddress,
  {
    maxConcurrent: 3,  // max parallel RPC calls (default: 3)
    minDelayMs: 400,   // ms between requests to avoid rate limits (default: 400)
  }
);

for (const stake of userStakes) {
  console.log({
    nonce: stake.nonce.toString(),
    amount: stake.stakedAmount,
    reward: stake.rewardAmount,
    claimed: stake.stakeClaimed,
    lockPeriod: stake.lockPeriod,
    txHash: stake.hash,
  });
}

// Single stake by address
const stakeAddress = deriveStakeAddress(
  wallet.publicKey,
  lockupAddress,
  0n,
  service.programId,
);
const stakeInfo = await service.getStakeInfo(stakeAddress, lockupAddress);
```

---

## Development

### Environment setup

Create a `.env` file at the project root for running tests:

```env
RPC_URL=https://your-mainnet-rpc-url
DEVNET_RPC_URL=https://your-devnet-rpc-url

# JSON arrays of base58-encoded secret keys
MAINNET_SECRET_KEYS=["base58SecretKey1","base58SecretKey2"]
DEVNET_SECRET_KEYS=["base58SecretKey1","base58SecretKey2"]
```

### Commands

```bash
# Build the package
npm run build

# Run all tests
npm test

# Run a single test file
npm run test:single ./test/e2e/getLockupInfo.test.ts

# Run a specific test by name pattern
npm run test:single ./test/e2e/stakeAndUnstake.test.ts -- -f "stake()"

# Format code
npm run format
```

### Publish

Build and bump the version in `package.json`, then:

```bash
npm publish --access public
```
