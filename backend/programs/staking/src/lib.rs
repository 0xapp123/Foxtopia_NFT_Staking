use anchor_lang::prelude::*;
use anchor_spl::token::{self, Approve, Revoke, ThawAccount, Token, TokenAccount, Transfer};
use metaplex_token_metadata::state::Metadata;
use mpl_token_metadata::{
    instruction::freeze_delegated_account, instruction::thaw_delegated_account,
};
use solana_program::program::invoke_signed;

pub mod account;
pub mod constants;
pub mod error;

use account::*;
use constants::*;
use error::*;

declare_id!("85SU7o78xMPtVVKPsVb4msfgw7foc3D4rtzTi9rSvqub");

#[program]
pub mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _global_bump: u8) -> Result<()> {
        let global_authority = &mut ctx.accounts.global_authority;
        global_authority.super_admin = ctx.accounts.admin.key();
        global_authority.total_staked_count = 0;
        global_authority.total_reward_distributed = 0;
        Ok(())
    }

    pub fn initialize_user_pool(ctx: Context<InitializeUserPool>) -> Result<()> {
        let mut user_pool = ctx.accounts.user_pool.load_init()?;
        user_pool.owner = ctx.accounts.owner.key();
        Ok(())
    }
    #[access_control(user(&ctx.accounts.user_pool, &ctx.accounts.owner))]
    pub fn stake_nft_to_pool<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, StakeNftToPool<'info>>,
        global_bump: u8,
        rarity: u64,
    ) -> Result<()> {
        let mint_metadata = &mut &ctx.accounts.mint_metadata;

        msg!("Metadata Account: {:?}", ctx.accounts.mint_metadata.key());
        let (metadata, _) = Pubkey::find_program_address(
            &[
                metaplex_token_metadata::state::PREFIX.as_bytes(),
                metaplex_token_metadata::id().as_ref(),
                ctx.accounts.nft_mint.key().as_ref(),
            ],
            &metaplex_token_metadata::id(),
        );
        require!(
            metadata == mint_metadata.key(),
            StakingError::InvaliedMetadata
        );

        let mut collectionId: u8 = 0;
        // Verify metadata is legit
        let nft_metadata = Metadata::from_account_info(mint_metadata)?;

        // Check if this NFT is the wanted collection and verified
        if let Some(creators) = nft_metadata.data.creators {
            let mut valid: u8 = 0;
            let mut collection: Pubkey = Pubkey::default();
            for creator in creators {
                if creator.address.to_string() == FOXTOPIA_ADDRESS && creator.verified == true {
                    valid = 1;
                    collection = creator.address;
                    collectionId = 1;
                    break;
                }
                if creator.address.to_string() == FOXTOPIA_GENESIS_ADDRESS
                    && creator.verified == true
                {
                    valid = 1;
                    collection = creator.address;
                    collectionId = 2;
                    break;
                }
            }
            require!(valid == 1, StakingError::UnkownOrNotAllowedNFTCollection);
            msg!("Collection= {:?}", collection);
        } else {
            return Err(error!(StakingError::MetadataCreatorParseError));
        };

        let mut user_pool = ctx.accounts.user_pool.load_mut()?;

        let mut rate: u64 = 0;
        match collectionId {
            1 => {
                if rarity > 0 && rarity < 2001 {
                    rate = 10 * TOKEN_DECIMAL;
                }
                if rarity > 2000 && rarity < 4001 {
                    rate = 75 * TOKEN_DECIMAL/10;
                }
                if rarity > 4000 && rarity < 6901 {
                    rate = 5 * TOKEN_DECIMAL;
                }
            }
            2 => {
                if rarity > 0 && rarity < 300 {
                    rate = 10 * TOKEN_DECIMAL;
                }
                if rarity > 300 && rarity < 601 {
                    rate = 75 * TOKEN_DECIMAL/10;
                }
            }
            _ => panic!(),
        }

        // Add data on Userpool and GlobalPool
        let timestamp = Clock::get()?.unix_timestamp;
        user_pool.add_nft(ctx.accounts.nft_mint.key(), rate, timestamp);
        msg!("Staked Time: {}", timestamp);

        ctx.accounts.global_authority.total_staked_count += 1;

        // Delegate the NFT account to the PDA
        let cpi_accounts = Approve {
            to: ctx.accounts.user_nft_token_account.to_account_info(),
            delegate: ctx.accounts.global_authority.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::approve(cpi_context, 1)?;

        // Freeze delegated account
        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let remaining_accs = &mut ctx.remaining_accounts.iter();
        let edition_info = next_account_info(remaining_accs)?;
        let metadata_program = next_account_info(remaining_accs)?;

        invoke_signed(
            &freeze_delegated_account(
                *metadata_program.key,
                ctx.accounts.global_authority.key(),
                ctx.accounts.user_nft_token_account.key(),
                *edition_info.key,
                ctx.accounts.nft_mint.key(),
            ),
            &[
                ctx.accounts.global_authority.to_account_info().clone(),
                ctx.accounts.user_nft_token_account.to_account_info(),
                edition_info.to_account_info(),
                ctx.accounts.nft_mint.to_account_info(),
            ],
            &[seeds],
        )?;

        Ok(())
    }

    #[access_control(user(&ctx.accounts.user_pool, &ctx.accounts.owner))]
    pub fn withdraw_nft_from_pool<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, WithdrawNftFromPool<'info>>,
        global_bump: u8,
    ) -> Result<()> {
        let mut user_pool = ctx.accounts.user_pool.load_mut()?;
        msg!("Staked Mint: {:?}", ctx.accounts.nft_mint.key());

        let timestamp = Clock::get()?.unix_timestamp;
        let reward: u64 = user_pool.remove_nft(ctx.accounts.nft_mint.key(), timestamp)?;
        msg!("Reward: {:?} Unstaked Time: {}", reward, timestamp);
        ctx.accounts.global_authority.total_staked_count -= 1;

        // Thaw delegated Account
        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let remaining_accs = &mut ctx.remaining_accounts.iter();
        let edition_info = next_account_info(remaining_accs)?;
        let metadata_program = next_account_info(remaining_accs)?;

        invoke_signed(
            &thaw_delegated_account(
                *metadata_program.key,
                ctx.accounts.global_authority.key(),
                ctx.accounts.user_nft_token_account.key(),
                *edition_info.key,
                ctx.accounts.nft_mint.key(),
            ),
            &[
                ctx.accounts.global_authority.to_account_info().clone(),
                ctx.accounts.user_nft_token_account.to_account_info(),
                edition_info.to_account_info(),
                ctx.accounts.nft_mint.to_account_info(),
            ],
            &[seeds],
        )?;

        let token_program = &mut &ctx.accounts.token_program;
        let signer = &[&seeds[..]];
        let cpi_accounts = Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.global_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                cpi_accounts,
                signer,
            ),
            reward,
        )?;

        ctx.accounts.global_authority.total_reward_distributed += reward;
        user_pool.accumulated_reward += reward;

        Ok(())
    }

    #[access_control(user(&ctx.accounts.user_pool, &ctx.accounts.owner))]
    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        global_bump: u8,
        mint: Option<Pubkey>,
    ) -> Result<()> {
        let timestamp = Clock::get()?.unix_timestamp;
        let mut user_pool = ctx.accounts.user_pool.load_mut()?;
        let reward: u64;
        if let Some(pubkey) = mint {
            reward = user_pool.claim_nft_reward(pubkey, timestamp)?;
        } else {
            reward = user_pool.claim_reward(timestamp)?;
        }
        msg!(
            "Reward: {:?} Updated Last Reward Time: {}",
            reward,
            user_pool.last_claimed_time
        );
        require!(reward > 0, StakingError::InvalidWithdrawTime);
        require!(
            ctx.accounts.reward_vault.amount >= reward,
            StakingError::InsufficientRewardVault
        );

        let token_program = &mut &ctx.accounts.token_program;
        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[global_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.global_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                cpi_accounts,
                signer,
            ),
            reward,
        )?;

        ctx.accounts.global_authority.total_reward_distributed += reward;
        user_pool.accumulated_reward += reward;

        Ok(())
    }

    pub fn withdraw_token(
        ctx: Context<WithdrawToken>,
        bump: u8,
        amount: u64,
    ) -> Result<()> {
        let global_authority = &mut ctx.accounts.global_authority;
        require!(ctx.accounts.owner.key() == global_authority.super_admin, StakingError::InvalidSuperOwner);

        let token_program = &mut &ctx.accounts.token_program;
        let seeds = &[GLOBAL_AUTHORITY_SEED.as_bytes(), &[bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.global_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                cpi_accounts,
                signer,
            ),
            amount,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init_if_needed,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump,
        space = 8 + 48,
        payer = admin
    )]
    pub global_authority: Account<'info, GlobalPool>,
    #[account(
        mut,
        constraint = reward_vault.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = reward_vault.owner == global_authority.key(),
        constraint = reward_vault.amount >= MIN_REWARD_VAULT_AMOUNT,
    )]
    pub reward_vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeUserPool<'info> {
    #[account(zero)]
    pub user_pool: AccountLoader<'info, UserPool>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct StakeNftToPool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub user_pool: AccountLoader<'info, UserPool>,

    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump,
    )]
    pub global_authority: Box<Account<'info, GlobalPool>>,
    #[account(
        mut,
        constraint = user_nft_token_account.mint == nft_mint.key(),
        constraint = user_nft_token_account.owner == *owner.key,
        constraint = user_nft_token_account.amount == 1,
    )]
    pub user_nft_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub nft_mint: AccountInfo<'info>,
    /// the mint metadata
    #[account(
        mut,
        constraint = mint_metadata.owner == &metaplex_token_metadata::ID
    )]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub mint_metadata: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(constraint = token_metadata_program.key == &metaplex_token_metadata::ID)]
    pub token_metadata_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct WithdrawNftFromPool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub user_pool: AccountLoader<'info, UserPool>,

    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump,
    )]
    pub global_authority: Box<Account<'info, GlobalPool>>,
    #[account(
        mut,
        constraint = user_nft_token_account.mint == nft_mint.key(),
        constraint = user_nft_token_account.owner == *owner.key,
    )]
    pub user_nft_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_vault.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = reward_vault.owner == global_authority.key(),
    )]
    pub reward_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_reward_account.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = user_reward_account.owner == *owner.key,
    )]
    pub user_reward_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub nft_mint: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump,
    )]
    pub global_authority: Box<Account<'info, GlobalPool>>,

    #[account(mut)]
    pub user_pool: AccountLoader<'info, UserPool>,

    #[account(
        mut,
        constraint = reward_vault.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = reward_vault.owner == global_authority.key(),
    )]
    pub reward_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_reward_account.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = user_reward_account.owner == *owner.key,
    )]
    pub user_reward_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct WithdrawToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [GLOBAL_AUTHORITY_SEED.as_ref()],
        bump,
    )]
    pub global_authority: Box<Account<'info, GlobalPool>>,
    #[account(
        mut,
        constraint = reward_vault.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = reward_vault.owner == global_authority.key(),
    )]
    pub reward_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_reward_account.mint == REWARD_TOKEN_MINT_PUBKEY.parse::<Pubkey>().unwrap(),
        constraint = user_reward_account.owner == *owner.key,
    )]
    pub user_reward_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

// Access control modifiers
fn user(pool_loader: &AccountLoader<UserPool>, user: &AccountInfo) -> Result<()> {
    let user_pool = pool_loader.load()?;
    require!(user_pool.owner == *user.key, StakingError::InvalidUserPool);
    Ok(())
}
