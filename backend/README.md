# Foxtopia-NFT-Staking🦊
This is the non-custodial staking program by using the 🥶Freeze Mechanism❄.

## Install Dependencies
- Install `node` and `yarn`
- Install `ts-node` as global command
- Confirm the solana wallet preparation: `/home/---/.config/solana/id.json` in test case

## Usage
- Main script source for all functionality is here: `/cli/script.ts`
- Program account types are declared here: `/cli/types.ts`
- Idl to make the JS binding easy is here: `/cli/staking.ts`

Able to test the script functions working in this way.
- Change commands properly in the main functions of the `script.ts` file to call the other functions
- Confirm the `ANCHOR_WALLET` environment variable of the `ts-node` script in `package.json`
- Run `yarn ts-node`

# Features

##  How to deploy this program?
First of all, you have to git clone in your PC.
In the folder `backend`, in the terminal 
1. `yarn`

2. `anchor build`
   In the last sentence you can see:  
```
 To deploy this program:
  $ solana program deploy /home/.../backend/target/deploy/staking.so
The program address will default to this keypair (override with --program-id):
  /home/.../backend/target/deploy/staking-keypair.json
```  
3. `solana-keygen pubkey /home/.../backend/target/deploy/staking-keypair.json`
4. You can get the pubkey of the `program ID : ex."5N...x6k"`
5. Please add this pubkey to the lib.rs
  `line 17: declare_id!("5N...x6k");`
6. Please add this pubkey to the Anchor.toml
  `line 4: staking = "5N...x6k"`
7. Please add this pubkey to the types.ts
  `line 6: export const STAKING_PROGRAM_ID = new PublicKey("5N...x6k");`
  
8. `anchor build` again
9. `solana program deploy /home/.../backend/target/deploy/staking.so`

<p align = "center">
Then, you can enjoy this program 🎭
</p>
</br>

## How to use?

### A Project Owner
The project owner should initialize the project. the function `initProject`
```js
    await initProject();
```

The only project owner can withdraw FOXIE tokens from this program. the function `withdrawToken`
```js
export const withdrawToken = async (
    amount: number
)
```

### Users
Users can stake, unstake, claime NFTs by using this program.

`Stake`

```js
export const stakeNFT = async (
    mint: PublicKey,
    rarity: number,
)
```

`Unstake`

```js
export const withdrawNft = async (
    mint: PublicKey,
) 
```

`Claim`

If there is the mint address of a specific NFT, this function is for this NFT and if there is not pubkey, this will be claim All the rewards.
```js
export const claimReward = async (
    mint?: PublicKey,
)
```
