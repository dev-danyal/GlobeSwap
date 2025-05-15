use anchor_lang::prelude::*;

#[account]
pub struct Escrow {
    pub seed: u64,              
    pub maker: Pubkey,          
    pub taker: Option<Pubkey>,  
    pub mint_a: Pubkey,          
    pub mint_b: Pubkey,          
    pub vault: Pubkey,         
    pub receive_amt: u64,        
    pub bump: u8,               
}

impl Escrow {
    pub const INIT_SPACE: usize = 8 + 8 +  32 + (1 + 32) + 32 + 32 + 32 + 8 + 1; 
}
