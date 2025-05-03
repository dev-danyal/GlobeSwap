pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5tE9oA4cuvPBmmVWpS8a4bKTWQZeHyoJy8nHEoxwvHc");

#[program]
pub mod globe_swap {
    use super::*;

    pub fn initialize_trade(
        ctx: Context<Initialize>,
        seed: u64,
        receive_amt: u64,
    ) -> Result<()> {
        ctx.accounts.create_escrow(seed, receive_amt, &ctx.bumps)?;
        Ok(())
    }

    pub fn join_trade(ctx: Context<JoinTrade>) -> Result<()> {
        ctx.accounts.execute_swap()?;
        Ok(())
    }
}

