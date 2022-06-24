import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export interface GlobalPool {
    // 8 + 40
    superAdmin: PublicKey,              // 32
    totalStakedCount: anchor.BN,        // 8
    totalRewardDistributed: anchor.BN
}

export interface StakedData {
    mint: PublicKey,                    // 32
    stakedTime: anchor.BN,              // 8
    claimedTime: anchor.BN,             // 8
    rate?: anchor.BN,                   // 8
}

export interface UserPool {
    // 8 + 5656
    owner: PublicKey,                   // 32
    lastClaimedTime: anchor.BN,         // 8
    stakedCount: anchor.BN,             // 8
    accumulatedReward: anchor.BN,
    staking: StakedData[],                  // 48 * 100
}