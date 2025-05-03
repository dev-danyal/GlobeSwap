// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { GlobeSwap } from "../target/types/globe_swap";

// describe("globe_swap", () => {
//   // Configure the client to use the local cluster.
//   anchor.setProvider(anchor.AnchorProvider.env());

//   const program = anchor.workspace.globeSwap as Program<GlobeSwap>;

//   it("Is initialized!", async () => {
//     // Add your test here.
//     const tx = await program.methods.initialize().rpc();
//     console.log("Your transaction signature", tx);
//   });
// });


import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { GlobeSwap } from "../target/types/globe_swap";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.GlobeSwap as Program<GlobeSwap>;

describe("GlobeSwap", () => {
  let seller = provider.wallet.publicKey;
  let buyer: anchor.web3.Keypair;

  let mintA: PublicKey;
  let mintB: PublicKey;

  let sellerAta: PublicKey;
  let buyerAtaB: PublicKey;

  let vaultA: PublicKey;
  let vaultABump: number;

  let makerReceiveAta: PublicKey;
  let buyerReceiveAta: PublicKey;

  let escrow: PublicKey;
  let escrowBump: number;

  const seed = new anchor.BN(777);
  const receiveAmt = new anchor.BN(50);

  before(async () => {
    buyer = anchor.web3.Keypair.generate();

    // Airdrop SOL to buyer
    const sig = await provider.connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // Create test mints
    mintA = await createMint(provider.connection, provider.wallet.payer, seller, null, 0);
    mintB = await createMint(provider.connection, provider.wallet.payer, buyer.publicKey, null, 0);

    // Create token accounts
    sellerAta = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, seller)).address;
    buyerAtaB = (await getOrCreateAssociatedTokenAccount(provider.connection, buyer, mintB, buyer.publicKey)).address;

    // Mint tokens
    await mintTo(provider.connection, provider.wallet.payer, mintA, sellerAta, seller, 100);
    await mintTo(provider.connection, provider.wallet.payer, mintB, buyerAtaB, buyer, 100);

    // Derive PDAs
    [escrow, escrowBump] = await PublicKey.findProgramAddressSync([
      Buffer.from("escrow"),
      seller.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8)
    ], program.programId);

    [vaultA, vaultABump] = await PublicKey.findProgramAddressSync([
      escrow.toBuffer(),
      (await anchor.utils.token.TOKEN_PROGRAM_ID).toBuffer(),
      mintA.toBuffer()
    ], program.programId);

    [makerReceiveAta] = await PublicKey.findProgramAddressSync([
      escrow.toBuffer(),
      (await anchor.utils.token.TOKEN_PROGRAM_ID).toBuffer(),
      mintB.toBuffer()
    ], program.programId);

    [buyerReceiveAta] = await PublicKey.findProgramAddressSync([
      buyer.publicKey.toBuffer(),
      (await anchor.utils.token.TOKEN_PROGRAM_ID).toBuffer(),
      mintA.toBuffer()
    ], program.programId);
  });

  it("Initializes trade", async () => {
    await program.methods.initializeTrade(seed, receiveAmt).accounts({
      seller,
      mintSeller: mintA,
      mintBuyer: mintB,
      sellerAta,
      escrow,
      vaultA,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId
    }).rpc();
  });

  it("Joins trade", async () => {
    await program.methods.joinTrade().accounts({
      buyer: buyer.publicKey,
      escrow,
      mintB,
      mintA,
      buyerAtaB,
      makerReceiveAta,
      vaultA,
      buyerReceiveAta,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([buyer]).rpc();
  });

  it("Checks vault and receiver balances", async () => {
    const buyerReceiveAcc = await getOrCreateAssociatedTokenAccount(provider.connection, buyer, mintA, buyer.publicKey);
    const makerReceiveAcc = await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintB, seller);

    assert.equal(Number(buyerReceiveAcc.amount), 100);
    assert.equal(Number(makerReceiveAcc.amount), 50);
  });
});
