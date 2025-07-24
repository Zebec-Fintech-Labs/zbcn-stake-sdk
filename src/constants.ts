import { BigNumber } from "bignumber.js";

import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Zebec Card Program Ids
 */
export const ZEBEC_STAKE_PROGRAM = {
	/** Mainnet Program Id */
	mainnet: "zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv",
	/** Devnet Program Id */
	devnet: "zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv",
};

export const ZBCN = new PublicKey("ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU");

/** BigNumber Object for 10 */
export const TEN_BIGNUM = BigNumber(10);

/** Token Program ID */
export const TOKEN_PROGRAM_ID = utils.token.TOKEN_PROGRAM_ID;

/** Associated Token Program ID */
export const ASSOCIATED_TOKEN_PROGRAM_ID = utils.token.ASSOCIATED_PROGRAM_ID;
