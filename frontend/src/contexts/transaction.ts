import {
    Edition,
    MetadataProgram,
} from "@metaplex-foundation/mpl-token-metadata";
import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    PublicKey,
    Connection,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
} from '@solana/web3.js';
import {
    GlobalPool,
    UserPool,
} from './types';
import {
    getUserPoolState as getUserPoolInfo,
    getAssociatedTokenAccount,
    getATokenAccountsNeedCreate,
    getNFTTokenAccount,
    getOwnerOfNFT,
    getMetadata,
    METAPLEX,
    isExistAccount,
    solConnection,
} from './utils';
import { EPOCH, FOXIE_TOKEN_DECIMAL, FOXIE_TOKEN_MINT, GLOBAL_AUTHORITY_SEED, SOLSCAN_API, STAKING_PROGRAM_ID, USER_POOL_SIZE } from "../config";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { errorAlert, errorAlertBottom, infoAlert, infoAlertBottom, successAlert, warningAlertBottom } from "../components/toastGroup";
import { IDL } from "./staking";

export const initUserPool = async (
    wallet: WalletContextState,
) => {
    if (!wallet.publicKey) return;
    let userAddress: PublicKey = wallet.publicKey;
    let cloneWindow: any = window;

    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
    let timeout: any;
    let timeInterval: any;
    try {

        let tx = await createInitUserPoolTx(userAddress, program, provider.connection);
        const txId = await wallet.sendTransaction(tx, solConnection);
        timeout = setTimeout(() => {
            // infoAlertBottom("Checking status...");
            timeInterval = setInterval(async () => {
                // infoAlertBottom("Checking status...");
                await fetch(`${SOLSCAN_API}${txId}`)
                    .then(resp =>
                        resp.json()
                    ).then(async (json) => {
                        if (json.status.toLowerCase() === "success" && json.signer.length !== 0) {
                            clearTimeout(timeout);
                            clearInterval(timeInterval);
                            successAlert("Transaction is confirmed..");
                        }
                        if (json.status.toLowerCase() === "fail") {
                            clearTimeout(timeout);
                            clearInterval(timeInterval);
                            errorAlert("Transaction is failed..");
                        }
                    })
                    .catch((error) => {
                        console.log(error);
                    })
            }, 5000)
        }, 8000);
        // await solConnection.confirmTransaction(txId, "finalized");
        successAlert("Init user pool has been successful!");
    } catch (error: any) {
        clearTimeout(timeout);
        clearInterval(timeInterval);
        if (error.message) {
            // Blockhash not found
            if (error.message.indexOf("Blockhash not found") !== -1) {
                warningAlertBottom("Blockhash not found. Please try again");
            } else {
                errorAlertBottom(error.message);
            }
        }
    }
}

export const stakeNFT = async (
    wallet: WalletContextState,
    // mint: PublicKey,
    nfts: any,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function,
) => {
    if (wallet.publicKey === null) return;
    const userAddress = wallet.publicKey;
    let timeout: any;
    let timeInterval: any;
    try {
        startLoading();
        let cloneWindow: any = window;
        let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
        const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);

        let userPoolKey = await anchor.web3.PublicKey.createWithSeed(
            userAddress,
            "user-pool",
            STAKING_PROGRAM_ID,
        );

        let poolAccount = await solConnection.getAccountInfo(userPoolKey);
        if (poolAccount === null || poolAccount.data === null) {
            await initUserPool(wallet);
        }
        let transactions: Transaction[] = [];
        for (let item of nfts) {
            const tx = await createStakeNftTx(new PublicKey(item.mint), wallet.publicKey, program, solConnection, item.rate);
            transactions.push(tx);
        }
        let { blockhash } = await provider.connection.getRecentBlockhash("confirmed");

        transactions.forEach((transaction) => {
            transaction.feePayer = (wallet.publicKey as PublicKey);
            transaction.recentBlockhash = blockhash;
        });
        if (wallet.signAllTransactions !== undefined) {
            const signedTransactions = await wallet.signAllTransactions(transactions);

            let signatures = await Promise.all(
                signedTransactions.map((transaction) =>
                    provider.connection.sendRawTransaction(transaction.serialize(), {
                        skipPreflight: true,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    })
                )
            );

            console.log(signatures, "===> SIngenation");

            infoAlert("A transaction request has been sent.");

            timeout = setTimeout(() => {
                // infoAlertBottom("Checking status...");
                timeInterval = setInterval(async () => {
                    // infoAlertBottom("Checking status...");
                    for (let i = 0; i < signatures.length; i++) {
                        console.log(`${SOLSCAN_API}${signatures[i]}`);
                        await fetch(`${SOLSCAN_API}${signatures[i]}`)
                            .then(resp =>
                                resp.json()
                            ).then(async (json) => {
                                console.log(json, `===> json ${i}`);
                                if (json.status.toLowerCase() === "fail") {
                                    errorAlert("Transaction is failed..");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                }
                                if (json.status.toLowerCase() === "success" && json.signer.length !== 0) {
                                    successAlert("Transaction is confirmed.");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                    updatePage();
                                }
                            })
                            .catch((error) => {
                                console.log(error);
                            })
                    }

                }, 5000)
            }, 8000);

        }

    } catch (error: any) {
        clearTimeout(timeout);
        clearInterval(timeInterval);
        if (error.message) {
            // Blockhash not found
            if (error.message.indexOf("Blockhash not found") !== -1) {
                warningAlertBottom("Blockhash not found. Please try again");
            } else {
                errorAlertBottom(error.message);
            }
        }
        closeLoading();
        updatePage();
    }
}

export const withdrawNft = async (
    wallet: WalletContextState,
    nfts: any,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function
) => {
    if (wallet.publicKey === null) return;
    let cloneWindow: any = window;
    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
    let timeout: any;
    let timeInterval: any;
    try {
        startLoading();
        let transactions: Transaction[] = [];
        for (let item of nfts) {
            const tx = await createWithdrawNftTx(new PublicKey(item.mint), wallet.publicKey, program, solConnection);
            transactions.push(tx);
        }

        let { blockhash } = await provider.connection.getRecentBlockhash("confirmed");

        transactions.forEach((transaction) => {
            transaction.feePayer = (wallet.publicKey as PublicKey);
            transaction.recentBlockhash = blockhash;
        });

        if (wallet.signAllTransactions !== undefined) {
            const signedTransactions = await wallet.signAllTransactions(transactions);

            let signatures = await Promise.all(
                signedTransactions.map((transaction) =>
                    provider.connection.sendRawTransaction(transaction.serialize(), {
                        skipPreflight: true,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    })
                    // wallet.sendTransaction(transaction, provider.connection, {maxRetries: 3, preflightCommitment: 'confirmed'})
                )
            );

            infoAlert("A transaction request has been sent.");
            timeout = setTimeout(() => {
                // infoAlertBottom("Checking status...");
                timeInterval = setInterval(async () => {
                    for (let i = 0; i < signatures.length; i++) {
                        console.log(`${SOLSCAN_API}${signatures[i]}`);
                        await fetch(`${SOLSCAN_API}${signatures[i]}`)
                            .then(resp =>
                                resp.json()
                            ).then(async (json) => {
                                console.log(json, `===> json ${i}`);
                                if (json.status.toLowerCase() === "fail") {
                                    errorAlert("Transaction is failed..");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                }
                                if (json.status.toLowerCase() === "success" && json.signer.length !== 0) {
                                    successAlert("Transaction is confirmed.");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                    updatePage();
                                }
                            })
                            .catch((error) => {
                                console.log(error);
                            })
                    }

                }, 5000)
            }, 8000);

        }
    } catch (error: any) {
        clearTimeout(timeout);
        clearInterval(timeInterval);
        if (error.message) {
            // Blockhash not found
            if (error.message.indexOf("Blockhash not found") !== -1) {
                warningAlertBottom("Blockhash not found. Please try again");
            } else {
                errorAlertBottom(error.message);
            }
        }
        closeLoading();
        updatePage();
    }
}

export const withdrawOneNft = async (
    wallet: WalletContextState,
    nft: string,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function
) => {
    if (wallet.publicKey === null) return;
    let cloneWindow: any = window;
    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
    let timeout: any;
    let timeInterval: any;
    try {
        startLoading();
        let transactions: Transaction[] = [];
        const tx = await createWithdrawNftTx(new PublicKey(nft), wallet.publicKey, program, solConnection);
        transactions.push(tx);

        let { blockhash } = await provider.connection.getRecentBlockhash("confirmed");

        transactions.forEach((transaction) => {
            transaction.feePayer = (wallet.publicKey as PublicKey);
            transaction.recentBlockhash = blockhash;
        });

        if (wallet.signAllTransactions !== undefined) {
            const signedTransactions = await wallet.signAllTransactions(transactions);

            let signatures = await Promise.all(
                signedTransactions.map((transaction) =>
                    provider.connection.sendRawTransaction(transaction.serialize(), {
                        skipPreflight: true,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    })
                    // wallet.sendTransaction(transaction, provider.connection, {maxRetries: 3, preflightCommitment: 'confirmed'})
                )
            );
            infoAlert("A transaction request has been sent.");
            timeout = setTimeout(() => {
                // infoAlertBottom("Checking status...");
                timeInterval = setInterval(async () => {
                    infoAlertBottom("Checking status...");
                    for (let i = 0; i < signatures.length; i++) {
                        console.log(`${SOLSCAN_API}${signatures[i]}`);
                        await fetch(`${SOLSCAN_API}${signatures[i]}`)
                            .then(resp =>
                                resp.json()
                            ).then(async (json) => {
                                console.log(json, `===> json ${i}`);
                                if (json.status.toLowerCase() === "fail") {
                                    errorAlert("Transaction is failed..");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                }
                                if (json.status.toLowerCase() === "success" && json.signer.length !== 0) {
                                    successAlert("Transaction is confirmed.");
                                    clearTimeout(timeout);
                                    clearInterval(timeInterval);
                                    closeLoading();
                                    updatePage();
                                }
                            })
                            .catch((error) => {
                                console.log(error);
                            })
                    }

                }, 5000)
            }, 8000);

        }
    } catch (error: any) {
        clearTimeout(timeout);
        clearInterval(timeInterval);
        if (error.message) {
            // Blockhash not found
            if (error.message.indexOf("Blockhash not found") !== -1) {
                warningAlertBottom("Blockhash not found. Please try again");
            } else {
                errorAlertBottom(error.message);
            }
        }
        closeLoading();
        updatePage();
    }
}

export const claimReward = async (
    wallet: WalletContextState,
    startLoading: Function,
    closeLoading: Function,
    updatePage: Function,
    mint?: PublicKey,
) => {
    if (wallet.publicKey === null) return;
    let cloneWindow: any = window;
    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
    let timeout: any;
    let timeInterval: any;
    try {
        startLoading();
        infoAlert("A transaction request has been sent.");
        const tx = await createClaimTx(wallet.publicKey, program, solConnection, mint);
        const txId = await wallet.sendTransaction(tx, solConnection); timeout = setTimeout(() => {
            // infoAlertBottom("Checking status...");
            console.log((`${SOLSCAN_API}${txId}`));
            timeInterval = setInterval(async () => {
                // infoAlertBottom("Checking status...");
                await fetch(`${SOLSCAN_API}${txId}`)
                    .then(resp =>
                        resp.json()
                    ).then(async (json) => {
                        console.log((json));
                        if (json.status.toLowerCase() === "fail") {
                            errorAlert("Transaction is failed..");
                            clearTimeout(timeout);
                            clearInterval(timeInterval);
                            closeLoading();
                        }
                        if (json.status.toLowerCase() === "success" && json.signer.length !== 0) {
                            successAlert("Transaction is confirmed..");
                            clearTimeout(timeout);
                            clearInterval(timeInterval);
                            closeLoading();
                            updatePage();
                        }
                    })
                    .catch((error) => {
                        console.log(error);
                    })
            }, 5000)
        }, 8000);
    } catch (error: any) {
        clearTimeout(timeout);
        clearInterval(timeInterval);
        if (error.message) {
            // Blockhash not found
            if (error.message.indexOf("Blockhash not found") !== -1) {
                warningAlertBottom("Blockhash not found. Please try again");
            } else {
                errorAlertBottom(error.message);
            }
        }
    }
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

    let tx = new Transaction();

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

    const metadata = await getMetadata(mint);
    const editionId = await Edition.getPDA(mint);
    console.log(editionId.toBase58(), "edition==========");
    console.log(MetadataProgram.PUBKEY.toBase58(), "Metadata==========");

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

export const getGlobalInfo = async () => {
    try {
        const state: GlobalPool | null = await getGlobalState();
        if (state === null) return false;
        const result = {
            admin: state.superAdmin.toBase58(),
            totalStakedCount: state.totalStakedCount.toNumber(),
        };

        return result;
    } catch (error) {
        console.log(error)
    }
}

export const getAllNFTs = async (rpc?: string) => {
    return await getAllStakedNFTs(solConnection, rpc);
}

export const getGlobalState = async (
): Promise<GlobalPool | null> => {
    let cloneWindow: any = window;
    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
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

export const calculateAllReward = async (
    userAddress: PublicKey,
) => {
    let cloneWindow: any = window;
    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);
    const state = await getUserPoolInfo(userAddress, program);
    let count = state?.stakedCount.toNumber();
    if (count === undefined) return;
    let totalReward = 0;
    for (let i = 0; i < count; i++) {
        let time = (state?.lastClaimedTime as anchor.BN).toNumber();
        if (time === undefined) return;
        if (state?.staking[i] === undefined) return;
        if (time < state?.staking[i].claimedTime.toNumber()) {
            time = state?.staking[i].claimedTime.toNumber();
        }
        let now = await getTimestamp();
        if (state?.staking[i].rate === undefined) return;
        let reward = Math.floor(480 * (now - time) / EPOCH) * (state?.staking[i].rate as anchor.BN).toNumber() / 480;
        totalReward += reward;
    }
    return totalReward;
}

export const getTimestamp = async () => {
    const slot = (await solConnection.getEpochInfo()).absoluteSlot;
    const timestamp = await solConnection.getBlockTime(slot);
    return timestamp ?? 0;
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

    let result: UserPool[] = [];

    try {
        for (let idx = 0; idx < poolAccounts.length; idx++) {
            let data = poolAccounts[idx].account.data;
            const owner = new PublicKey(data.slice(8, 40));

            let buf = data.slice(40, 48).reverse();
            const lastClaimedTime = new anchor.BN(buf);

            buf = data.slice(48, 56).reverse();
            const stakedCount = new anchor.BN(buf);

            buf = data.slice(56, 64).reverse();
            const accumulatedReward = new anchor.BN(buf);

            let staking = [];
            for (let i = 0; i < stakedCount.toNumber(); i++) {
                const mint = new PublicKey(data.slice(i * 56 + 64, i * 56 + 96));

                buf = data.slice(i * 56 + 96, i * 56 + 104).reverse();
                const stakedTime = new anchor.BN(buf);
                buf = data.slice(i * 56 + 104, i * 56 + 112).reverse();
                const claimedTime = new anchor.BN(buf);
                buf = data.slice(i * 56 + 112, i * 56 + 120).reverse();
                const rate = new anchor.BN(buf);

                staking.push({
                    mint,
                    stakedTime,
                    claimedTime,
                    rate,
                })
            }

            result.push({
                owner,
                lastClaimedTime,
                stakedCount,
                accumulatedReward,
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
                accumulatedReward: info.accumulatedReward.toNumber(),
                staking: info.staking.map((info) => {
                    if (info.rate)
                        return {
                            mint: info.mint.toBase58(),
                            stakedTime: info.stakedTime.toNumber(),
                            claimedTime: info.claimedTime.toNumber(),
                            rate: info.rate.toNumber(),
                        }
                }),
            }
        })
    }
};

export const calculateReward = async (wallet: WalletContextState, nftMint: PublicKey) => {
    if (!wallet.publicKey) return 0;
    let userAddress: PublicKey = wallet.publicKey;
    let cloneWindow: any = window;

    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);


    const globalPool: GlobalPool | null = await getGlobalState();
    if (globalPool === null) return 0;

    const userPool: UserPool | null = await getUserPoolState(userAddress, program);
    if (userPool === null) return 0;

    let slot = await solConnection.getSlot();
    let now = await solConnection.getBlockTime(slot);
    if (now === null) return 0;

    let reward = 0;

    for (let i = 0; i < userPool.stakedCount.toNumber(); i++) {
        if (userPool.staking[i].mint.toBase58() === nftMint.toBase58()) {
            reward = Math.floor(480 * (now - userPool.staking[i].claimedTime.toNumber()) / EPOCH) * ((userPool.staking[i].rate as anchor.BN).toNumber()) / 480;
        }

    }
    return reward / FOXIE_TOKEN_DECIMAL;
};

export const calculateAllRewards = async (
    wallet: WalletContextState
) => {
    if (wallet.publicKey === null) return 0;

    let userAddress: PublicKey = wallet.publicKey;
    let cloneWindow: any = window;

    let provider = new anchor.AnchorProvider(solConnection, cloneWindow['solana'], anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program(IDL as anchor.Idl, STAKING_PROGRAM_ID, provider);

    const globalPool: GlobalPool | null = await getGlobalState();
    if (globalPool === null) return 0;

    const userPool: UserPool | null = await getUserPoolState(userAddress, program);
    if (userPool === null) return 0;

    let slot = await solConnection.getSlot();
    let now = await solConnection.getBlockTime(slot);
    if (now === null) return 0;

    let total_reward = 0;

    for (let i = 0; i < userPool.stakedCount.toNumber(); i++) {
        let lastClaimedTime = userPool.lastClaimedTime.toNumber();
        if (lastClaimedTime < userPool.staking[i].claimedTime.toNumber()) {
            lastClaimedTime = userPool.staking[i].claimedTime.toNumber();
        }

        let reward = Math.floor(480 * (now - userPool.staking[i].claimedTime.toNumber()) / EPOCH) * ((userPool.staking[i].rate as anchor.BN).toNumber()) / 480;

        total_reward += reward;
    }

    return total_reward / FOXIE_TOKEN_DECIMAL;
};