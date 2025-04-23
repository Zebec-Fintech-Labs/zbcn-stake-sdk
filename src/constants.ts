import { BigNumber } from "bignumber.js";
import dotenv from "dotenv";

import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

dotenv.config();

const SDK_ENV = process.env.SDK_ENV ?? "production";

export const isSdkEnvDev = SDK_ENV === "development";

/**
 * Zebec Card Program Ids
 */
export const ZBCN_STAKE_PROGRAM = {
	/** Mainnet Program Id */
	mainnet: "HxZq3iRwN2a2myikHz8JNVufJ7FM92xV8kNvFpQaRgKd",
	/** Devnet Program Id */
	devnet: "HxZq3iRwN2a2myikHz8JNVufJ7FM92xV8kNvFpQaRgKd",
};

/** USDC Decimals = 6 */
export const USDC_DECIMALS = 6;

/**
 * WSOL Mint Address
 */
export const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

export const ZBCN = new PublicKey("ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU");

/** BigNumber Object for 10 */
export const TEN_BIGNUM = BigNumber(10);

export const UNITS_PER_USDC = TEN_BIGNUM.pow(USDC_DECIMALS);

/** Token Program ID */
export const TOKEN_PROGRAM_ID = utils.token.TOKEN_PROGRAM_ID;

/** Associated Token Program ID */
export const ASSOCIATED_TOKEN_PROGRAM_ID = utils.token.ASSOCIATED_PROGRAM_ID;

/** Memo Program ID */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * In millisecond
 */
export const DEFAULT_SEND_TRANSACTION_INTERVAL = 1000;

/**
 * Max compute budget unit
 */
export const MAX_COMPUTE_UNIT = 1_400_000;

export const DEFAULT_SWAP_FEE = 5;

export const BASE_FEE_LAMPORTS = 5000;

export const LAMPORTS_PER_MICRO_LAMPORT = 0.000001;

export const DEFAULT_MAX_PRIORITY_FEE = 0.001;
