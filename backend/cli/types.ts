import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export const GLOBAL_AUTHORITY_SEED = "global-authority";

export const STAKING_PROGRAM_ID = new PublicKey("85SU7o78xMPtVVKPsVb4msfgw7foc3D4rtzTi9rSvqub");
export const FOXIE_TOKEN_MINT = new PublicKey("6Tf26EZ2F8efATQpodGKYMNMZccCTL1VPYzcC4kPF6cC");
export const FOXIE_TOKEN_DECIMAL = 1_000_000_000; 

export const EPOCH = 120;
export const LOCKING_PERIOD = 60;
export const USER_POOL_SIZE = 5664;     // 8 + 5656

export interface GlobalPool {
    // 8 + 40
    superAdmin: PublicKey,          // 32
    totalStakedCount: anchor.BN,    // 8
}

export interface StakedData {
    mint: PublicKey,        // 32
    stakedTime: anchor.BN, // 8
    claimedTime: anchor.BN, // 8
    rate: anchor.BN,      // 8
}

export interface UserPool {
    // 8 + 5656
    owner: PublicKey,               // 32
    lastClaimedTime: anchor.BN,     // 8
    stakedCount: anchor.BN,         // 8
    staking: StakedData[],          // 48 * 100
}
