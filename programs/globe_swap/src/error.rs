use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("A buyer has already joined this trade")]
    AlreadyJoined,
}
