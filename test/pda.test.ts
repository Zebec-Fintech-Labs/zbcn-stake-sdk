import { describe } from "mocha";

import { deriveLockupAddress, deriveRewardVaultAddress, deriveStakeVaultAddress, ZEBEC_STAKE_PROGRAM } from "../src";

describe("PDAs derive functions", () => {
	it("derive pdas", () => {
		const lockupName = "ZBCN Lockup";
		const lockupAddress = deriveLockupAddress(lockupName, ZEBEC_STAKE_PROGRAM.devnet);
		console.log("lockup:", lockupAddress.toString());

		const stakeVault = deriveStakeVaultAddress(lockupAddress, ZEBEC_STAKE_PROGRAM.devnet);
		console.log("stakeVault:", stakeVault.toString());

		const rewardVault = deriveRewardVaultAddress(lockupAddress, ZEBEC_STAKE_PROGRAM.devnet);
		console.log("rewardVault:", rewardVault.toString());
	});
});
