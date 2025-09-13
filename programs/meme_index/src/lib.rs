use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("BKrYs7V1WMXEHYxr61FdUK9wHKrBqrzSzYmNRegts1mG");

pub const MAX_ASSETS: usize = 5;

#[program]
pub mod meme_index {
	use super::*;

	pub fn initialize_index(
		ctx: Context<InitializeIndex>,
		assets: [Pubkey; MAX_ASSETS],
		num_assets: u8,
		exit_fee_bps: u16,
	) -> Result<()> {
		require!(num_assets as usize <= MAX_ASSETS && num_assets > 0, ErrorCode::InvalidNumAssets);
		let cfg = &mut ctx.accounts.config;
		cfg.authority = ctx.accounts.authority.key();
		cfg.index_mint = ctx.accounts.index_mint.key();
		cfg.exit_fee_bps = exit_fee_bps; // 50 = 0.5%
		cfg.num_assets = num_assets;
		cfg.total_shares = 0;
		cfg.assets_mints = assets;
		cfg.bump = ctx.bumps.config;
		Ok(())
	}

	pub fn deposit_and_mint<'info>(ctx: Context<'_, '_, 'info, 'info, DepositAndMint<'info>>, amounts: Vec<u64>) -> Result<()> {
		let num_assets = ctx.accounts.config.num_assets as usize;
		require!(amounts.len() == num_assets, ErrorCode::InvalidArrayLen);

		// Parse remaining accounts and validate them
		require!(ctx.remaining_accounts.len() == num_assets * 3, ErrorCode::AccountsMismatch);
		
		let mut vault_balances: Vec<u64> = Vec::with_capacity(num_assets);
		let mut mint_decimals: Vec<u8> = Vec::with_capacity(num_assets);
		for i in 0..num_assets {
			let vault_ata: Account<TokenAccount> = Account::try_from(&ctx.remaining_accounts[i * 3 + 1])?;
			require_keys_eq!(vault_ata.mint, ctx.accounts.config.assets_mints[i], ErrorCode::MintOrderMismatch);
			vault_balances.push(vault_ata.amount);
			
			let mint: Account<Mint> = Account::try_from(&ctx.remaining_accounts[i * 3 + 2])?;
			require_keys_eq!(mint.key(), ctx.accounts.config.assets_mints[i], ErrorCode::MintOrderMismatch);
			mint_decimals.push(mint.decimals);
		}

		let shares_out: u64 = if ctx.accounts.config.total_shares == 0 {
			let mut min_norm: u128 = u128::MAX;
			for i in 0..num_assets {
				let dec = mint_decimals[i] as i32;
				let scale_pow = 9 - dec;
				let scaled: u128 = if scale_pow >= 0 {
					(amounts[i] as u128)
						.checked_mul(ten_pow_u128(scale_pow as u32))
						.ok_or(ErrorCode::MathOverflow)?
				} else {
					(amounts[i] as u128)
						.checked_div(ten_pow_u128((-scale_pow) as u32))
						.ok_or(ErrorCode::MathOverflow)?
				};
				if scaled < min_norm { min_norm = scaled; }
			}
			require!(min_norm > 0, ErrorCode::ZeroDeposit);
			for i in 0..num_assets {
				if amounts[i] > 0 {
					transfer_tokens(
						&ctx.accounts.token_program,
						&ctx.remaining_accounts[i * 3],
						&ctx.remaining_accounts[i * 3 + 1],
						&ctx.accounts.depositor,
						amounts[i],
					)?;
				}
			}
			u128_to_u64(min_norm)?
		} else {
			let mut per_share_units: Vec<u64> = Vec::with_capacity(num_assets);
			let mut y_candidates: Vec<u64> = Vec::with_capacity(num_assets);
			for i in 0..num_assets {
				let per_share = ceil_div_u64(vault_balances[i], ctx.accounts.config.total_shares);
				require!(per_share > 0, ErrorCode::InvalidPerShareUnits);
				per_share_units.push(per_share);
				let y_i = amounts[i] / per_share;
				y_candidates.push(y_i);
			}
			let y = *y_candidates.iter().min().ok_or(ErrorCode::Internal)?;
			require!(y > 0, ErrorCode::InsufficientProportions);
			for i in 0..num_assets {
				let required = per_share_units[i]
					.checked_mul(y)
					.ok_or(ErrorCode::MathOverflow)?;
				if required > 0 {
					transfer_tokens(
						&ctx.accounts.token_program,
						&ctx.remaining_accounts[i * 3],
						&ctx.remaining_accounts[i * 3 + 1],
						&ctx.accounts.depositor,
						required,
					)?;
				}
			}
			y
		};

		mint_shares(
			&ctx.accounts.token_program,
			&ctx.accounts.index_mint,
			&ctx.accounts.index_mint_authority,
			&ctx.accounts.depositor_index_ata,
			&ctx.accounts.config,
			shares_out,
			ctx.bumps.index_mint_authority,
		)?;

		ctx.accounts.config.total_shares = ctx.accounts.config
			.total_shares
			.checked_add(shares_out)
			.ok_or(ErrorCode::MathOverflow)?;

		Ok(())
	}

	pub fn redeem_to_basket<'info>(ctx: Context<'_, '_, 'info, 'info, RedeemToBasket<'info>>, shares_in: u64) -> Result<()> {
		require!(shares_in > 0 && shares_in <= ctx.accounts.config.total_shares, ErrorCode::InvalidShareAmount);

		let num_assets = ctx.accounts.config.num_assets as usize;
		require!(ctx.remaining_accounts.len() == num_assets * 2, ErrorCode::AccountsMismatch);

		burn_shares(
			&ctx.accounts.token_program,
			&ctx.accounts.index_mint,
			&ctx.accounts.depositor_index_ata,
			&ctx.accounts.depositor,
			shares_in,
		)?;

		for i in 0..num_assets {
			let vault_ata: Account<TokenAccount> = Account::try_from(&ctx.remaining_accounts[i * 2 + 1])?;
			require_keys_eq!(vault_ata.mint, ctx.accounts.config.assets_mints[i], ErrorCode::MintOrderMismatch);
			let balance = vault_ata.amount;
			let numerator: u128 = (balance as u128)
				.checked_mul(shares_in as u128)
				.ok_or(ErrorCode::MathOverflow)?;
			let pro_rata: u64 = u128_to_u64(numerator / (ctx.accounts.config.total_shares as u128))?;
			if pro_rata == 0 { continue; }
			let fee: u64 = pro_rata
				.checked_mul(ctx.accounts.config.exit_fee_bps as u64)
				.ok_or(ErrorCode::MathOverflow)?
				/ 10_000;
			let net = pro_rata.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;
			if net > 0 {
				transfer_from_vault(
					&ctx.accounts.token_program,
					&ctx.remaining_accounts[i * 2 + 1],
					&ctx.remaining_accounts[i * 2],
					&ctx.accounts.index_mint_authority,
					&ctx.accounts.config,
					net,
					ctx.bumps.index_mint_authority,
				)?;
			}
		}

		ctx.accounts.config.total_shares = ctx.accounts.config
			.total_shares
			.checked_sub(shares_in)
			.ok_or(ErrorCode::MathOverflow)?;

		Ok(())
	}
}

#[derive(Accounts)]
pub struct InitializeIndex<'info> {
	#[account(mut)]
	pub authority: Signer<'info>,
	#[account(
		init,
		payer = authority,
		space = 8 + Config::SIZE,
		seeds = [b"config", index_mint.key().as_ref()],
		bump,
	)]
	pub config: Account<'info, Config>,
	pub index_mint: Account<'info, Mint>,
	pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositAndMint<'info> {
	#[account(mut)]
	pub depositor: Signer<'info>,
	#[account(
		mut,
		seeds = [b"config", index_mint.key().as_ref()],
		bump = config.bump,
	)]
	pub config: Account<'info, Config>,
	#[account(mut)]
	pub index_mint: Account<'info, Mint>,
	/// CHECK: This is a PDA derived from the config account, so it's safe to use as UncheckedAccount
	#[account(seeds = [b"vault_authority", config.key().as_ref()], bump)]
	pub index_mint_authority: UncheckedAccount<'info>,
	#[account(
		init_if_needed,
		payer = depositor,
		associated_token::mint = index_mint,
		associated_token::authority = depositor,
	)]
	pub depositor_index_ata: Account<'info, TokenAccount>,
	pub token_program: Program<'info, Token>,
	pub associated_token_program: Program<'info, AssociatedToken>,
	pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedeemToBasket<'info> {
	#[account(mut)]
	pub depositor: Signer<'info>,
	#[account(
		mut,
		seeds = [b"config", index_mint.key().as_ref()],
		bump = config.bump,
	)]
	pub config: Account<'info, Config>,
	#[account(mut)]
	pub index_mint: Account<'info, Mint>,
	/// CHECK: This is a PDA derived from the config account, so it's safe to use as UncheckedAccount
	#[account(seeds = [b"vault_authority", config.key().as_ref()], bump)]
	pub index_mint_authority: UncheckedAccount<'info>,
	#[account(
		mut,
		associated_token::mint = index_mint,
		associated_token::authority = depositor,
	)]
	pub depositor_index_ata: Account<'info, TokenAccount>,
	pub token_program: Program<'info, Token>,
}

#[account]
pub struct Config {
	pub authority: Pubkey,
	pub index_mint: Pubkey,
	pub exit_fee_bps: u16,
	pub num_assets: u8,
	pub bump: u8,
	pub total_shares: u64,
	pub assets_mints: [Pubkey; MAX_ASSETS],
}

impl Config {
	pub const SIZE: usize = 32 + 32 + 2 + 1 + 1 + 8 + (32 * MAX_ASSETS);
}

fn transfer_tokens<'info>(
	token_program: &Program<'info, Token>,
	from: &AccountInfo<'info>,
	to: &AccountInfo<'info>,
	authority: &Signer<'info>,
	amount: u64,
) -> Result<()> {
	let cpi_accounts = Transfer {
		from: from.clone(),
		to: to.clone(),
		authority: authority.to_account_info(),
	};
	let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts);
	token::transfer(cpi_ctx, amount)
}

fn transfer_from_vault<'info>(
	token_program: &Program<'info, Token>,
	from: &AccountInfo<'info>,
	to: &AccountInfo<'info>,
	vault_authority: &UncheckedAccount<'info>,
	config: &Account<'info, Config>,
	amount: u64,
	bump: u8,
) -> Result<()> {
	let config_key = config.key();
	let seeds: &[&[u8]] = &[b"vault_authority", config_key.as_ref(), &[bump]];
	let signer = &[seeds];
	let cpi_accounts = Transfer {
		from: from.clone(),
		to: to.clone(),
		authority: vault_authority.to_account_info(),
	};
	let cpi_ctx = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
	token::transfer(cpi_ctx, amount)
}

fn mint_shares<'info>(
	token_program: &Program<'info, Token>,
	mint: &Account<'info, Mint>,
	mint_authority: &UncheckedAccount<'info>,
	to: &Account<'info, TokenAccount>,
	config: &Account<'info, Config>,
	amount: u64,
	bump: u8,
) -> Result<()> {
	let config_key = config.key();
	let seeds: &[&[u8]] = &[b"vault_authority", config_key.as_ref(), &[bump]];
	let signer = &[seeds];
	let cpi_accounts = MintTo {
		mint: mint.to_account_info(),
		to: to.to_account_info(),
		authority: mint_authority.to_account_info(),
	};
	let cpi_ctx = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
	token::mint_to(cpi_ctx, amount)
}

fn burn_shares<'info>(
	token_program: &Program<'info, Token>,
	mint: &Account<'info, Mint>,
	from: &Account<'info, TokenAccount>,
	owner: &Signer<'info>,
	amount: u64,
) -> Result<()> {
	let cpi_accounts = Burn {
		mint: mint.to_account_info(),
		from: from.to_account_info(),
		authority: owner.to_account_info(),
	};
	let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts);
	token::burn(cpi_ctx, amount)
}

fn ceil_div_u64(a: u64, b: u64) -> u64 {
	if a == 0 { return 0; }
	((a as u128 + b as u128 - 1) / b as u128) as u64
}

fn ten_pow_u128(p: u32) -> u128 { 10u128.pow(p) }

fn u128_to_u64(x: u128) -> Result<u64> {
	u64::try_from(x).map_err(|_| error!(ErrorCode::MathOverflow))
}

#[error_code]
pub enum ErrorCode {
	#[msg("Invalid number of assets")] InvalidNumAssets,
	#[msg("Bump not found")] BumpNotFound,
	#[msg("Mismatched array length")] InvalidArrayLen,
	#[msg("Remaining accounts malformed")] AccountsMismatch,
	#[msg("Mint order mismatch")] MintOrderMismatch,
	#[msg("Math overflow")] MathOverflow,
	#[msg("Zero deposit")] ZeroDeposit,
	#[msg("Per-share units invalid")] InvalidPerShareUnits,
	#[msg("Deposit not proportional to basket")] InsufficientProportions,
	#[msg("Internal error")] Internal,
	#[msg("Invalid share amount")] InvalidShareAmount,
}
