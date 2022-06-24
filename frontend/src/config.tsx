import { PublicKey } from "@solana/web3.js";
//mainnet-beta | devnet
export const NETWORK = "mainnet-beta";

//Solana RPC URL
export const SOLANA_RPC = "https://a2-mind-prd-api.azurewebsites.net/rpc";
// Solscan API URL for confirmation of transaction
export const SOLSCAN_API = "https://public-api.solscan.io/transaction/";
export const GLOBAL_AUTHORITY_SEED = "global-authority";

export const STAKING_PROGRAM_ID = new PublicKey("85SU7o78xMPtVVKPsVb4msfgw7foc3D4rtzTi9rSvqub");
export const FOXIE_TOKEN_MINT = new PublicKey("6Tf26EZ2F8efATQpodGKYMNMZccCTL1VPYzcC4kPF6cC");
export const FOXIE_TOKEN_DECIMAL = 1_000_000_000;   // FOXIE Token Decimal
// 60 * 60 * 24 = 1 day
export const EPOCH = 86400;
// lock time 10s
export const LOCKING_PERIOD = 10;
export const USER_POOL_SIZE = 5664;     // 8 + 5648

export const FOXTOPIA_GENESIS_CREATOR_ADDRESS = "8ZfAeDqjH5Jg82nDwiDdfLu6XFcpdaDxHpbQo9uuqYY3";
export const FOXTOPIA_CREATOR_ADDRESS = "8cdswr2xu41W4VaydrJqZ3G5qk89yd6kx5r374EhypUM";

export const LIVE_URL = "https://foxtopiastaking.herokuapp.com/"