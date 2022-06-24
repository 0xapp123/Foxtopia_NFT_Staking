import {
    Edition,
    MetadataProgram,
} from "@metaplex-foundation/mpl-token-metadata";
import { Program, web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';

import { IDL as StakingIDL } from "./staking";
import {
    Keypair,
    PublicKey,
    Connection,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
} from '@solana/web3.js';
import {
    STAKING_PROGRAM_ID,
    GLOBAL_AUTHORITY_SEED,
    GlobalPool,
    FOXIE_TOKEN_MINT,
    USER_POOL_SIZE,
    FOX_TOKEN_DECIMAL,
    UserPool,
} from './types';
import {
    getAssociatedTokenAccount,
    getATokenAccountsNeedCreate,
    getNFTTokenAccount,
    getOwnerOfNFT,
    getMetadata,
    METAPLEX,
    isExistAccount,
} from './utils';
import { programs } from "@metaplex/js";

let program: Program = null;

// Address of the deployed program.
let programId = new anchor.web3.PublicKey(STAKING_PROGRAM_ID);

anchor.setProvider(anchor.AnchorProvider.local(web3.clusterApiUrl("mainnet-beta")));
const solConnection = anchor.getProvider().connection;
const payer = anchor.AnchorProvider.local().wallet;

// Generate the program client from IDL.
program = new anchor.Program(StakingIDL as anchor.Idl, programId);
console.log('ProgramId: ', program.programId.toBase58());

const main = async () => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        program.programId
    );
    console.log('GlobalAuthority: ', globalAuthority.toBase58());

    await initProject();

    // await initUserPool(payer.publicKey);

    // await stakeNFT(new PublicKey('KZxdj9dWRUnsyeryH8Wp1FYMaoJeaB5yr7oyJLpeta3'), 3);
    // await withdrawNft(new PublicKey('KZxdj9dWRUnsyeryH8Wp1FYMaoJeaB5yr7oyJLpeta3'));
    // await stakeNft(payer.publicKey, new PublicKey('FLuGogNV1UPns65SCz8ZLBnPx1P9EtcjVphvbyg2t6ix'), false);
    // await withdrawNft(payer.publicKey, new PublicKey('GF4XmpVKCf9aozU5igmr9sKNzDBkjvmiWujx8uC7Bnp4'));
    // await withdrawNft(payer.publicKey, new PublicKey('FLuGogNV1UPns65SCz8ZLBnPx1P9EtcjVphvbyg2t6ix'));
    // await claimReward(payer.publicKey, new PublicKey('FLuGogNV1UPns65SCz8ZLBnPx1P9EtcjVphvbyg2t6ix'));

    // const userPool: UserPool = await getUserPoolState(payer.publicKey);
    // await testMetadata(new PublicKey("22HpVhS1SmUQHBCz9sPansBwyziDC77Rs1jkPHCPMsf3"));
};

export const testMetadata = async (
    nftMint: PublicKey
) => {
    let { metadata: { Metadata } } = programs;
    let metadataAccount = await Metadata.getPDA(nftMint);
    const metadata = await Metadata.load(solConnection, metadataAccount);
    let creators = metadata.data.data.creators;

    console.log("MintMetadata's Creator Addresses =", creators.map((creator) => creator.address));
}

export const initProject = async (
) => {
    const tx = await createInitializeTx(payer.publicKey, program);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}


export const initUserPool = async (
) => {
    const tx = await createInitUserPoolTx(payer.publicKey, program, solConnection);
    const { blockhash } = await solConnection.getRecentBlockhash('finalized');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "finalized");
    console.log("Your transaction signature", txId);
}

export const stakeNFT = async (
    mint: PublicKey,
    rarity: number,
) => {
    console.log(mint.toBase58(), rarity);

    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        payer.publicKey,
        "user-pool",
        STAKING_PROGRAM_ID,
    );

    let poolAccount = await solConnection.getAccountInfo(userPoolKey);
    if (poolAccount === null || poolAccount.data === null) {
        await initUserPool();
    }

    const tx = await createStakeNftTx(mint, payer.publicKey, program, solConnection, rarity);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("Your transaction signature", txId);
}


export const withdrawNft = async (
    mint: PublicKey,
) => {
    console.log(mint.toBase58());

    const tx = await createWithdrawNftTx(mint, payer.publicKey, program, solConnection);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("Your transaction signature", txId);
}

export const claimReward = async (
    mint?: PublicKey,
) => {
    console.log(mint ? mint.toBase58() : 'Claim all');

    const tx = await createClaimTx(payer.publicKey, program, solConnection, mint);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("Your transaction signature", txId);
}

export const withdrawToken = async (
    amount: number
) => {
    const tx = await createWithdrawTx(payer.publicKey, amount, program, solConnection);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("Your transaction signature", txId);
}


export const createInitializeTx = async (
    userAddress: PublicKey,
    program: anchor.Program,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID,
    );
    const rewardVault = await getAssociatedTokenAccount(globalAuthority, FOXIE_TOKEN_MINT);
    console.log(rewardVault.toBase58());

    let tx = new Transaction();
    console.log('==>initializing program', rewardVault.toBase58());

    tx.add(program.instruction.initialize(
        bump, {
        accounts: {
            admin: userAddress,
            globalAuthority,
            rewardVault,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [],
        signers: [],
    }));

    return tx;
}

export const createInitUserPoolTx = async (
    userAddress: PublicKey,
    program: anchor.Program,
    connection: Connection,
) => {
    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        userAddress,
        "user-pool",
        STAKING_PROGRAM_ID,
    );
    console.log(USER_POOL_SIZE);
    let ix = SystemProgram.createAccountWithSeed({
        fromPubkey: userAddress,
        basePubkey: userAddress,
        seed: "user-pool",
        newAccountPubkey: userPoolKey,
        lamports: await connection.getMinimumBalanceForRentExemption(USER_POOL_SIZE),
        space: USER_POOL_SIZE,
        programId: STAKING_PROGRAM_ID,
    });

    let tx = new Transaction();
    console.log('==>initializing user PDA', userPoolKey.toBase58());
    tx.add(ix);
    tx.add(program.instruction.initializeUserPool(
        {
            accounts: {
                userPool: userPoolKey,
                owner: userAddress
            },
            instructions: [],
            signers: []
        }
    ));

    return tx;
}

export const createStakeNftTx = async (
    mint: PublicKey,
    userAddress: PublicKey,
    program: anchor.Program,
    connection: Connection,
    rarity: number,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID,
    );

    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        userAddress,
        "user-pool",
        STAKING_PROGRAM_ID,
    );

    let userTokenAccount = await getAssociatedTokenAccount(userAddress, mint);
    if (!await isExistAccount(userTokenAccount, connection)) {
        let accountOfNFT = await getNFTTokenAccount(mint, connection);
        if (userTokenAccount.toBase58() != accountOfNFT.toBase58()) {
            let nftOwner = await getOwnerOfNFT(mint, connection);
            if (nftOwner.toBase58() == userAddress.toBase58()) userTokenAccount = accountOfNFT;
            else if (nftOwner.toBase58() !== globalAuthority.toBase58()) {
                throw 'Error: Nft is not owned by user';
            }
        }
    }
    console.log("NFT = ", mint.toBase58(), userTokenAccount.toBase58());

    let { instructions, destinationAccounts } = await getATokenAccountsNeedCreate(
        connection,
        userAddress,
        globalAuthority,
        [mint]
    );

    console.log("Dest NFT Account = ", destinationAccounts[0].toBase58())

    const metadata = await getMetadata(mint);

    console.log("Metadata=", metadata.toBase58());
    const editionId = await Edition.getPDA(mint);
    let remainingAccounts = [
        {
            pubkey: editionId,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: MetadataProgram.PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];

    let tx = new Transaction();

    if (instructions.length > 0) instructions.map((ix) => tx.add(ix));
    console.log('==>listing', mint.toBase58(), rarity);

    tx.add(program.instruction.stakeNftToPool(
        bump, new anchor.BN(rarity), {
        accounts: {
            owner: userAddress,
            globalAuthority,
            userPool: userPoolKey,
            userNftTokenAccount: userTokenAccount,
            nftMint: mint,
            mintMetadata: metadata,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: METAPLEX,
        },
        remainingAccounts,
        instructions: [],
        signers: [],
    }));

    return tx;
}

export const createWithdrawNftTx = async (
    mint: PublicKey,
    userAddress: PublicKey,
    program: anchor.Program,
    connection: Connection,
) => {
    let ret = await getATokenAccountsNeedCreate(
        connection,
        userAddress,
        userAddress,
        [mint]
    );
    let userTokenAccount = ret.destinationAccounts[0];
    console.log("User NFT = ", mint.toBase58(), userTokenAccount.toBase58());

    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID
    );
    let rewardVault = await getAssociatedTokenAccount(globalAuthority, FOXIE_TOKEN_MINT);

    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        userAddress,
        "user-pool",
        STAKING_PROGRAM_ID,
    );

    let ret1 = await getATokenAccountsNeedCreate(
        connection,
        userAddress,
        userAddress,
        [FOXIE_TOKEN_MINT]
    );

    const editionId = await Edition.getPDA(mint);
    let remainingAccounts = [
        {
            pubkey: editionId,
            isSigner: false,
            isWritable: true,
        },
        {
            pubkey: MetadataProgram.PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];

    let tx = new Transaction();

    if (ret.instructions.length > 0) ret.instructions.map((ix) => tx.add(ix));
    if (ret1.instructions.length > 0) ret1.instructions.map((ix) => tx.add(ix));
    console.log('==> withdrawing', mint.toBase58());

    tx.add(program.instruction.withdrawNftFromPool(
        bump, {
        accounts: {
            owner: userAddress,
            globalAuthority,
            userPool: userPoolKey,
            userNftTokenAccount: userTokenAccount,
            rewardVault,
            userRewardAccount: ret1.destinationAccounts[0],
            nftMint: mint,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        remainingAccounts,
        instructions: [],
        signers: [],
    }));

    return tx;
}

export const createClaimTx = async (
    userAddress: PublicKey,
    program: anchor.Program,
    connection: Connection,
    mint?: PublicKey,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID
    );
    let rewardVault = await getAssociatedTokenAccount(globalAuthority, FOXIE_TOKEN_MINT);

    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        userAddress,
        "user-pool",
        STAKING_PROGRAM_ID,
    );

    let ret = await getATokenAccountsNeedCreate(
        connection,
        userAddress,
        userAddress,
        [FOXIE_TOKEN_MINT]
    );

    let tx = new Transaction();

    if (ret.instructions.length > 0) ret.instructions.map((ix) => tx.add(ix));
    tx.add(program.instruction.claimReward(
        bump, mint ?? null, {
        accounts: {
            owner: userAddress,
            globalAuthority,
            userPool: userPoolKey,
            rewardVault,
            userRewardAccount: ret.destinationAccounts[0],
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [],
        signers: [],
    }));

    return tx;
}


export const createWithdrawTx = async (
    userAddress: PublicKey,
    amount: number,
    program: anchor.Program,
    connection: Connection,
) => {
    const [globalAuthority, bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID
    );
    let rewardVault = await getAssociatedTokenAccount(globalAuthority, FOXIE_TOKEN_MINT);

    let ret = await getATokenAccountsNeedCreate(
        connection,
        userAddress,
        userAddress,
        [FOXIE_TOKEN_MINT]
    );

    let tx = new Transaction();

    if (ret.instructions.length > 0) ret.instructions.map((ix) => tx.add(ix));
    tx.add(program.instruction.withdrawToken(
        bump, new anchor.BN(amount*FOX_TOKEN_DECIMAL), {
        accounts: {
            owner: userAddress,
            globalAuthority,
            rewardVault,
            userRewardAccount: ret.destinationAccounts[0],
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [],
        signers: [],
    }));

    return tx;
}
export const getUserPoolInfo = async (
    userAddress: PublicKey,
) => {
    const userInfo: UserPool = await getUserPoolState(userAddress, program);
    return {
        owner: userInfo.owner.toBase58(),
        lastClaimedTime: userInfo.lastClaimedTime.toNumber(),
        stakedCount: userInfo.stakedCount.toNumber(),
        staking: userInfo.staking.map((info) => {
            return {
                mint: info.mint.toBase58(),
                stakedTime: info.stakedTime.toNumber(),
                claimedTime: info.claimedTime.toNumber(),
                rarity: info.rate.toNumber(),
            }
        }),
    };
}

export const getGlobalInfo = async () => {
    const globalPool: GlobalPool = await getGlobalState(program);
    const result = {
        admin: globalPool.superAdmin.toBase58(),
        totalStakedCount: globalPool.totalStakedCount.toNumber(),
    };

    return result;
}

export const getAllNFTs = async (rpc?: string) => {
    return await getAllStakedNFTs(solConnection, rpc);
}


export const getGlobalState = async (
    program: anchor.Program,
): Promise<GlobalPool | null> => {
    const [globalAuthority, _] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        STAKING_PROGRAM_ID
    );
    try {
        let globalState = await program.account.globalPool.fetch(globalAuthority);
        return globalState as unknown as GlobalPool;
    } catch {
        return null;
    }
}

export const getUserPoolState = async (
    userAddress: PublicKey,
    program: anchor.Program,
): Promise<UserPool | null> => {
    let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
        userAddress,
        "user-pool",
        STAKING_PROGRAM_ID,
    );
    try {
        let userPoolState = await program.account.userPool.fetch(userPoolKey);
        return userPoolState as unknown as UserPool;
    } catch {
        return null;
    }
}

export const getAllStakedNFTs = async (connection: Connection, rpcUrl: string | undefined) => {
    let solConnection = connection;

    if (rpcUrl) {
        solConnection = new anchor.web3.Connection(rpcUrl, "confirmed");
    }

    let poolAccounts = await solConnection.getProgramAccounts(
        STAKING_PROGRAM_ID,
        {
            filters: [
                {
                    dataSize: USER_POOL_SIZE,
                },
            ]
        }
    );

    console.log(`Encounter ${poolAccounts.length} NFT Data Accounts`);

    let result: UserPool[] = [];

    try {
        for (let idx = 0; idx < poolAccounts.length; idx++) {
            let data = poolAccounts[idx].account.data;
            const owner = new PublicKey(data.slice(8, 40));

            let buf = data.slice(40, 48).reverse();
            const lastClaimedTime = new anchor.BN(buf);

            buf = data.slice(48, 56).reverse();
            const stakedCount = new anchor.BN(buf);

            let staking = [];
            for (let i = 0; i < stakedCount.toNumber(); i++) {
                const mint = new PublicKey(data.slice(i * 56 + 56, i * 56 + 88));

                buf = data.slice(i * 56 + 88, i * 56 + 96).reverse();
                const stakedTime = new anchor.BN(buf);
                buf = data.slice(i * 56 + 96, i * 56 + 104).reverse();
                const claimedTime = new anchor.BN(buf);
                buf = data.slice(i * 56 + 104, i * 56 + 112).reverse();
                const rarity = new anchor.BN(buf);

                staking.push({
                    mint,
                    stakedTime,
                    claimedTime,
                    rarity,
                })
            }

            result.push({
                owner,
                lastClaimedTime,
                stakedCount,
                staking,
            });
        }
    } catch (e) {
        console.log(e);
        return {};
    }

    return {
        count: result.length,
        data: result.map((info: UserPool) => {
            return {
                owner: info.owner.toBase58(),
                lastClaimedTime: info.lastClaimedTime.toNumber(),
                stakedCount: info.stakedCount.toNumber(),
                staking: info.staking.map((info) => {
                    return {
                        mint: info.mint.toBase58(),
                        stakedTime: info.stakedTime.toNumber(),
                        claimedTime: info.claimedTime.toNumber(),
                        rarity: info.rate.toNumber(),
                    }
                }),
            }
        })
    }
};

main();
