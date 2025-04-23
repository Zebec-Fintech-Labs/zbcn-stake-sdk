/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 */
export type StakeZbcn = {
	address: "6S5tbu8jPJKFvpBMjaMPQbcwcrw8iHcuGnXH8ZwHgwaE";
	metadata: {
		name: "stakeZbcn";
		version: "0.1.0";
		spec: "0.1.0";
		description: "Created with Anchor";
	};
	instructions: [
		{
			name: "initLockup";
			discriminator: [6, 96, 207, 185, 103, 62, 239, 168];
			accounts: [
				{
					name: "creator";
					writable: true;
					signer: true;
				},
				{
					name: "lockup";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [122, 101, 98, 101, 99, 95, 108, 111, 99, 107, 117, 112];
							},
							{
								kind: "arg";
								path: "args.name";
							},
						];
					};
				},
				{
					name: "stakeVault";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [115, 116, 97, 107, 101, 95, 118, 97, 117, 108, 116];
							},
							{
								kind: "account";
								path: "lockup";
							},
						];
					};
				},
				{
					name: "stakeToken";
				},
				{
					name: "rewardToken";
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
				{
					name: "tokenProgram";
					address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
				},
				{
					name: "associatedTokenProgram";
					address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
				},
			];
			args: [
				{
					name: "params";
					type: {
						defined: {
							name: "initConfigParams";
						};
					};
				},
			];
		},
		{
			name: "stakeZbcn";
			discriminator: [93, 162, 156, 54, 43, 11, 15, 122];
			accounts: [
				{
					name: "staker";
					writable: true;
					signer: true;
				},
				{
					name: "lockup";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [122, 101, 98, 101, 99, 95, 108, 111, 99, 107, 117, 112];
							},
							{
								kind: "account";
								path: "lockup.stake_info.name";
								account: "lockup";
							},
						];
					};
				},
				{
					name: "userPda";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "account";
								path: "lockup";
							},
							{
								kind: "arg";
								path: "args.nonce";
							},
						];
					};
				},
				{
					name: "userNonce";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "account";
								path: "lockup";
							},
						];
					};
				},
				{
					name: "stakeToken";
				},
				{
					name: "stakerTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "stakeToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "stakeVault";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [115, 116, 97, 107, 101, 95, 118, 97, 117, 108, 116];
							},
							{
								kind: "account";
								path: "lockup";
							},
						];
					};
				},
				{
					name: "stakeVaultTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "stakeVault";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "stakeToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
				{
					name: "tokenProgram";
					address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
				},
				{
					name: "associatedTokenProgram";
					address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
				},
			];
			args: [
				{
					name: "params";
					type: {
						defined: {
							name: "stakeParams";
						};
					};
				},
			];
		},
		{
			name: "unstakeZbcn";
			discriminator: [90, 202, 101, 187, 218, 99, 244, 1];
			accounts: [
				{
					name: "staker";
					writable: true;
					signer: true;
				},
				{
					name: "lockup";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [122, 101, 98, 101, 99, 95, 108, 111, 99, 107, 117, 112];
							},
							{
								kind: "account";
								path: "lockup.stake_info.name";
								account: "lockup";
							},
						];
					};
				},
				{
					name: "stakePda";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "account";
								path: "lockup";
							},
							{
								kind: "arg";
								path: "nonce";
							},
						];
					};
				},
				{
					name: "rewardToken";
				},
				{
					name: "stakeToken";
				},
				{
					name: "stakerTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "rewardToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "stakerRewardTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "staker";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "rewardToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "stakeVault";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [115, 116, 97, 107, 101, 95, 118, 97, 117, 108, 116];
							},
							{
								kind: "account";
								path: "lockup";
							},
						];
					};
				},
				{
					name: "stakeVaultTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "stakeVault";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "rewardToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "stakeVaultRewardTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "stakeVault";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "rewardToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "feeVault";
				},
				{
					name: "feeVaultTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "account";
								path: "lockup.fee_info.fee_vault";
								account: "lockup";
							},
							{
								kind: "const";
								value: [
									6,
									221,
									246,
									225,
									215,
									101,
									161,
									147,
									217,
									203,
									225,
									70,
									206,
									235,
									121,
									172,
									28,
									180,
									133,
									237,
									95,
									91,
									55,
									145,
									58,
									140,
									245,
									133,
									126,
									255,
									0,
									169,
								];
							},
							{
								kind: "account";
								path: "stakeToken";
							},
						];
						program: {
							kind: "const";
							value: [
								140,
								151,
								37,
								143,
								78,
								36,
								137,
								241,
								187,
								61,
								16,
								41,
								20,
								142,
								13,
								131,
								11,
								90,
								19,
								153,
								218,
								255,
								16,
								132,
								4,
								142,
								123,
								216,
								219,
								233,
								248,
								89,
							];
						};
					};
				},
				{
					name: "tokenProgram";
					address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
				},
				{
					name: "associatedTokenProgram";
					address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "nonce";
					type: "u64";
				},
			];
		},
	];
	accounts: [
		{
			name: "lockup";
			discriminator: [1, 45, 32, 32, 57, 81, 88, 67];
		},
		{
			name: "userNonce";
			discriminator: [235, 133, 1, 243, 18, 135, 88, 224];
		},
		{
			name: "userStakeData";
			discriminator: [105, 207, 3, 141, 114, 114, 232, 147];
		},
	];
	errors: [
		{
			code: 6000;
			name: "stakeAlreadyClaimed";
			msg: "Stake Already Claimed";
		},
		{
			code: 6001;
			name: "stakeNotClaimable";
			msg: "Stake Not Claimable";
		},
	];
	types: [
		{
			name: "durationMap";
			type: {
				kind: "struct";
				fields: [
					{
						name: "duration";
						type: "u64";
					},
					{
						name: "reward";
						type: "u64";
					},
				];
			};
		},
		{
			name: "feeInfo";
			type: {
				kind: "struct";
				fields: [
					{
						name: "fee";
						type: "u64";
					},
					{
						name: "feeVault";
						type: "pubkey";
					},
				];
			};
		},
		{
			name: "initConfigParams";
			type: {
				kind: "struct";
				fields: [
					{
						name: "name";
						type: "string";
					},
					{
						name: "lockPeriod";
						type: "i64";
					},
					{
						name: "fee";
						type: "u64";
					},
					{
						name: "feeVault";
						type: "pubkey";
					},
					{
						name: "durationMap";
						type: {
							vec: {
								defined: {
									name: "durationMap";
								};
							};
						};
					},
				];
			};
		},
		{
			name: "lockup";
			type: {
				kind: "struct";
				fields: [
					{
						name: "stakeInfo";
						type: {
							defined: {
								name: "stakeInfo";
							};
						};
					},
					{
						name: "rewardToken";
						type: {
							defined: {
								name: "rewardToken";
							};
						};
					},
					{
						name: "stakedToken";
						type: {
							defined: {
								name: "stakedToken";
							};
						};
					},
					{
						name: "feeInfo";
						type: {
							defined: {
								name: "feeInfo";
							};
						};
					},
				];
			};
		},
		{
			name: "rewardToken";
			type: {
				kind: "struct";
				fields: [
					{
						name: "tokenAddress";
						type: "pubkey";
					},
				];
			};
		},
		{
			name: "stakeInfo";
			type: {
				kind: "struct";
				fields: [
					{
						name: "name";
						type: "string";
					},
					{
						name: "creator";
						type: "pubkey";
					},
					{
						name: "durationMap";
						type: {
							vec: {
								defined: {
									name: "durationMap";
								};
							};
						};
					},
				];
			};
		},
		{
			name: "stakeParams";
			type: {
				kind: "struct";
				fields: [
					{
						name: "amount";
						type: "u64";
					},
					{
						name: "lockPeriod";
						type: "i64";
					},
					{
						name: "nonce";
						type: "u64";
					},
				];
			};
		},
		{
			name: "stakedToken";
			type: {
				kind: "struct";
				fields: [
					{
						name: "tokenAddress";
						type: "pubkey";
					},
					{
						name: "totalStaked";
						type: "u64";
					},
				];
			};
		},
		{
			name: "userNonce";
			type: {
				kind: "struct";
				fields: [
					{
						name: "nonce";
						type: "u64";
					},
				];
			};
		},
		{
			name: "userStakeData";
			type: {
				kind: "struct";
				fields: [
					{
						name: "nonce";
						type: "u64";
					},
					{
						name: "staker";
						type: "pubkey";
					},
					{
						name: "createdTime";
						type: "i64";
					},
					{
						name: "stakedAmount";
						type: "u64";
					},
					{
						name: "rewardAmount";
						type: "u64";
					},
					{
						name: "stakeClaimed";
						type: "bool";
					},
					{
						name: "lockPeriod";
						type: "i64";
					},
				];
			};
		},
	];
	constants: [
		{
			name: "lockup";
			type: "string";
			value: '"zebec_lockup"';
		},
		{
			name: "stakeVault";
			type: "string";
			value: '"stake_vault"';
		},
	];
};
