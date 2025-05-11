use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked},
};

use crate::state::Escrow;

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint_seller: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint_buyer: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_seller,
        associated_token::authority = seller,
        associated_token::token_program = token_program
    )]
    pub seller_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = seller,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", seller.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint_seller,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl Initialize<'_> {
    pub fn create_escrow(&mut self, seed: u64, receive_amt: u64, bumps: &InitializeBumps) -> Result<()> {
        // Initialize escrow account
        self.escrow.set_inner(Escrow {
            seed,
            maker: self.seller.key(),
            taker: None,
            mint_a: self.mint_seller.key(),
            mint_b: self.mint_buyer.key(),
            receive_amt,
            bump: bumps.escrow,
            vault_a: self.vault_a.key(),
            vault_b: Pubkey::default(),
        });

        // Transfer tokens from seller to vault
        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.seller_ata.to_account_info(),
                mint: self.mint_seller.to_account_info(),
                to: self.vault_a.to_account_info(),
                authority: self.seller.to_account_info(),
            },
        );
        transfer_checked(cpi_ctx, 100, self.mint_seller.decimals)?;

        Ok(())
    }
}