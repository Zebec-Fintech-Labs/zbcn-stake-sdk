import { createAnchorProvider, RewardScheme, StakeServiceBuilder } from "../../src";
import { getConnection, getWallets } from "../shared";

describe("Init Lockup", () => {
	const network = "devnet";
	const connection = getConnection(network);
	const wallets = getWallets(network);
	const wallet = wallets[0];
	console.log("\twallet:", wallet.publicKey.toString());
	const provider = createAnchorProvider(connection, wallet, { commitment: "confirmed" });

	const service = new StakeServiceBuilder().setNetwork(network).setProvider(provider).setProgram().build();

	describe("initLock()", () => {
		it("initialize staking lock", async () => {
			const rewardToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const stakeToken = "De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc";
			const fee = 0;
			const feeVault = "AA8B8zv68QCT8pkJL9vd6nAG9MzopARH9xvY1CLgAQQQ";
			const name = "Lockup 002";
			const rewardSchemes: RewardScheme[] = [
				{
					// duration: 2592000, // 30 days
					duration: 30,
					rewardRate: "8",
				},
				{
					// duration: 7776000, // 90 days
					duration: 90,
					rewardRate: "12",
				},
				{
					// duration: 10368000, // 120 days
					duration: 120,
					rewardRate: "15",
				},
			];
			const minimumStake = 0.000001;

			const payload = await service.initLockup({
				rewardToken,
				stakeToken,
				fee,
				feeVault,
				name,
				rewardSchemes,
				minimumStake,
			});

			const signature = await payload.execute({ commitment: "finalized" });

			console.log("signature:", signature);
		});
	});
});
