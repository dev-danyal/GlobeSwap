use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{state::Escrow, error::ErrorCode};

#[derive(Accounts)]
pub struct JoinTrade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.maker.as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mint::token_program = token_program,
        address = escrow.mint_b
    )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program,
        address = escrow.mint_a
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = buyer,
        associated_token::token_program = token_program
    )]
    pub buyer_ata_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = escrow.maker,
        associated_token::token_program = token_program
    )]
    pub maker_receive_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = buyer,
        associated_token::token_program = token_program
    )]
    pub buyer_receive_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> JoinTrade<'info> {
    pub fn execute_swap(&mut self) -> Result<()> {
        // Check if trade is already joined
        require!(self.escrow.taker.is_none(), ErrorCode::AlreadyJoined);

        // Get escrow data
        let maker = self.escrow.maker;
        let seed = self.escrow.seed;
        let bump = self.escrow.bump;
        let receive_amt = self.escrow.receive_amt;

        // Set the taker
        self.escrow.taker = Some(self.buyer.key());

        // 1. Buyer sends payment to Maker (TokenB from buyer to seller)
        let cpi_ctx_b_to_maker = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.buyer_ata_b.to_account_info(),
                mint: self.mint_b.to_account_info(),
                to: self.maker_receive_ata.to_account_info(),
                authority: self.buyer.to_account_info(),
            },
        );
        transfer_checked(
            cpi_ctx_b_to_maker,
            receive_amt,
            self.mint_b.decimals,
        )?;

        // 2. Escrow sends asset to Buyer (TokenA from vault to buyer)
        let escrow_seeds = &[
            b"escrow",
            maker.as_ref(),
            &seed.to_le_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        let cpi_ctx_a_to_buyer = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.vault.to_account_info(),
                mint: self.mint_a.to_account_info(),
                to: self.buyer_receive_ata.to_account_info(),
                authority: self.escrow.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(
            cpi_ctx_a_to_buyer,
            self.vault.amount,
            self.mint_a.decimals,
        )?;

        Ok(())
    }
}
