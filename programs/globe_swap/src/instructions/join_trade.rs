// use crate::error::ErrorCode;
// use anchor_lang::prelude::*;
// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked},
// };

// use crate::state::Escrow;

// #[derive(Accounts)]
// pub struct JoinTrade<'info> {
//     #[account(mut)]
//     pub buyer: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [b"escrow", escrow.maker.as_ref(), escrow.seed.to_le_bytes().as_ref()],
//         bump = escrow.bump,
//     )]
//     pub escrow: Account<'info, Escrow>,

//     #[account(
//         mint::token_program = token_program
//     )]
//     pub mint_buyer: InterfaceAccount<'info, Mint>,

//     #[account(
//         mut,
//         associated_token::mint = mint_buyer,
//         associated_token::authority = buyer,
//         associated_token::token_program = token_program
//     )]
//     pub buyer_ata: InterfaceAccount<'info, TokenAccount>,

//     #[account(
//         mut,
//         associated_token::mint = mint_buyer,
//         associated_token::authority = escrow,
//         associated_token::token_program = token_program
//     )]
//     pub vault: InterfaceAccount<'info, TokenAccount>,

//     pub associated_token_program: Program<'info, AssociatedToken>,
//     pub token_program: Interface<'info, TokenInterface>,
//     pub system_program: Program<'info, System>,
// }

// impl JoinTrade<'_> {
//     pub fn deposit_and_join(&mut self, amount: u64) -> Result<()> {
//         require!(self.escrow.taker.is_none(), ErrorCode::AlreadyJoined);

//         // Save buyer and mark deposit
//         self.escrow.taker = Some(self.buyer.key());

//         let cpi_ctx = CpiContext::new(
//             self.token_program.to_account_info(),
//             TransferChecked {
//                 from: self.buyer_ata.to_account_info(),
//                 mint: self.mint_buyer.to_account_info(),
//                 to: self.vault.to_account_info(),
//                 authority: self.buyer.to_account_info(),
//             },
//         );

//         transfer_checked(cpi_ctx, amount, self.mint_buyer.decimals)
//     }
// }




use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::state::Escrow;

#[derive(Accounts)]
pub struct JoinTrade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
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
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint_b,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub maker_receive_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
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
        let escrow = &self.escrow;

        // 1. Buyer sends payment to Maker
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
            escrow.receive_amt,
            self.mint_b.decimals,
        )?;

        // 2. Escrow sends asset to Buyer
        let bump = escrow.bump;
        let escrow_seeds = &[
            b"escrow",
            escrow.maker.as_ref(),
            &escrow.seed.to_le_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        let cpi_ctx_a_to_buyer = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.vault_a.to_account_info(),
                mint: self.mint_a.to_account_info(),
                to: self.buyer_receive_ata.to_account_info(),
                authority: self.escrow.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(
            cpi_ctx_a_to_buyer,
            self.vault_a.amount,
            self.mint_a.decimals,
        )?;

        // 3. Close escrow account and refund rent to maker
        let maker = self.buyer.to_account_info();
        self.escrow.close(maker)?;

        Ok(())
    }
}
