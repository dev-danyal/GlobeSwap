use anchor_lang::prelude::*;

#[account]
pub struct Escrow {
    pub seed: u64,               // Unique identifier for the trade
    pub maker: Pubkey,           // Seller (Maker) who initiated the trade
    pub taker: Option<Pubkey>,   // Buyer (Taker) who will join the trade
    pub mint_a: Pubkey,          // Asset type for seller
    pub mint_b: Pubkey,          // Asset type for buyer
    pub vault_a: Pubkey,         // Vault holding the seller's asset
    pub vault_b: Pubkey,         // Vault holding the buyer's asset
    pub receive_amt: u64,        // Amount buyer needs to send
    pub bump: u8,                // PDA bump for escrow
}

impl Escrow {
    pub const INIT_SPACE: usize = 8 + 32 + 1 + 32 + 32 + 32 + 32 + 8 + 1; // space for all fields
}
