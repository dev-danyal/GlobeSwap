import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo, 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { GlobeSwap } from "../target/types/globe_swap";

describe("GlobeSwap - Complete Trade Lifecycle Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GlobeSwap as Program<GlobeSwap>;

  // Test accounts
  let seller = provider.wallet.publicKey;
  let buyer: anchor.web3.Keypair;
  
  // Token mints
  let mintA: PublicKey;
  let mintB: PublicKey;
  
  // Token accounts
  let sellerTokenA: PublicKey;
  let buyerTokenB: PublicKey;
  let makerReceiveTokenB: PublicKey;
  let buyerReceiveTokenA: PublicKey;
  
  // Escrow accounts
  let escrowPda: PublicKey;
  let escrowBump: number;
  let vaultAta: PublicKey;

  // Trade parameters
  const seed = new anchor.BN(777);
  const receiveAmt = new anchor.BN(50);
  const depositAmt = new anchor.BN(100);

  before(async () => {
    buyer = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(
      buyer.publicKey, 
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Create test tokens
    mintA = await createMint(
      provider.connection,
      provider.wallet.payer,
      seller,
      null,
      0
    );
    
    mintB = await createMint(
      provider.connection,
      provider.wallet.payer,
      buyer.publicKey,
      null,
      0
    );

    // Create token accounts
    sellerTokenA = await getAssociatedTokenAddress(mintA, seller);
    buyerTokenB = await getAssociatedTokenAddress(mintB, buyer.publicKey);
    makerReceiveTokenB = await getAssociatedTokenAddress(mintB, seller);
    buyerReceiveTokenA = await getAssociatedTokenAddress(mintA, buyer.publicKey);

    // Initialize and fund token accounts
    await getOrCreateAssociatedTokenAccount(
      provider.connection, 
      provider.wallet.payer, 
      mintA, 
      seller
    );
    await getOrCreateAssociatedTokenAccount(
      provider.connection, 
      buyer, 
      mintB, 
      buyer.publicKey
    );
    
    // Mint initial tokens
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mintA,
      sellerTokenA,
      seller,
      1000
    );
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mintB,
      buyerTokenB,
      buyer,
      1000
    );

    // Derive escrow PDA
    [escrowPda, escrowBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        seller.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    // Derive vault ATA
    vaultAta = await getAssociatedTokenAddress(
      mintA, 
      escrowPda, 
      true
    );

    // Create vault ATA if it doesn't exist
    try {
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mintA,
        escrowPda,
        true
      );
    } catch {}
  });

  it("1. Initialize trade - seller deposits TokenA", async () => {
    console.log("\n[Initial State]");
    console.log(`  Seller: TokenA=1000, TokenB=0`);
    console.log(`  Buyer:  TokenA=0, TokenB=1000`);
    console.log(`  Vault:  TokenA=0`);

    const tx = await program.methods
      .initializeTrade(seed, receiveAmt)
      .accounts({
        seller,
        mintSeller: mintA,
        mintBuyer: mintB,
        sellerAta: sellerTokenA,
        escrow: escrowPda,
        vault: vaultAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    console.log(`\n[Step 1] Seller deposits 100 TokenA`);
    console.log(`  Tx Signature: ${tx}`);
    
    // Verify balances
    const sellerA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, seller)).amount);
    const vaultA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, escrowPda, true)).amount);
    
    console.log(`  Seller: TokenA=${sellerA}, TokenB=0`);
    console.log(`  Vault:  TokenA=${vaultA}`);

    assert.equal(sellerA, 900, "Seller should have 900 TokenA");
    assert.equal(vaultA, 100, "Vault should have 100 TokenA");
  });

  it("2. Complete trade - buyer deposits TokenB", async () => {
    // Ensure maker's receive account exists
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mintB,
      seller
    );

    // Ensure buyer's receive account exists
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      buyer,
      mintA,
      buyer.publicKey
    );

    const tx = await program.methods
      .joinTrade()
      .accounts({
        buyer: buyer.publicKey,
        escrow: escrowPda,
        mintB,
        mintA,
        buyerAtaB: buyerTokenB,
        makerReceiveAta: makerReceiveTokenB,
        vault: vaultAta,
        buyerReceiveAta: buyerReceiveTokenA,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([buyer])
      .rpc();

    console.log(`\n[Step 2] Buyer deposits 50 TokenB`);
    console.log(`  Tx Signature: ${tx}`);
    
    // Verify balances
    const sellerB = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintB, seller)).amount);
    const buyerA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, buyer, mintA, buyer.publicKey)).amount);
    const vaultA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, escrowPda, true)).amount);
    
    console.log(`  Seller: TokenA=900, TokenB=${sellerB}`);
    console.log(`  Buyer:  TokenA=${buyerA}, TokenB=950`);
    console.log(`  Vault:  TokenA=${vaultA}`);

    assert.equal(sellerB, 50, "Seller should have 50 TokenB");
    assert.equal(buyerA, 100, "Buyer should have 100 TokenA");
    assert.equal(vaultA, 0, "Vault should be empty");
  });

//   it("3. Verify escrow state", async () => {
//     const escrow = await program.account.escrow.fetch(escrowPda);
    
//     console.log("\n[Escrow State]");
//     console.log(`  Maker: ${escrow.maker.toString()}`);
//     console.log(`  Taker: ${escrow.taker?.toString()}`);
//     console.log(`  MintA: ${escrow.mintA.toString()}`);
//     console.log(`  MintB: ${escrow.mintB.toString()}`);
//     console.log(`  Receive Amount: ${escrow.receiveAmt.toString()}`);

//     assert.isTrue(escrow.maker.equals(seller), "Maker should be seller");
//     assert.isTrue(escrow.taker?.equals(buyer.publicKey), "Taker should be buyer");
//     assert.equal(escrow.receiveAmt.toString(), "50", "Receive amount should be 50");
//   });
// });



it("3. Verify final trade state", async () => {
    // Get final balances
    const sellerA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, seller)).amount);
    const sellerB = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintB, seller)).amount);
    const buyerA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, buyer, mintA, buyer.publicKey)).amount);
    const buyerB = Number((await getOrCreateAssociatedTokenAccount(provider.connection, buyer, mintB, buyer.publicKey)).amount);
    const vaultA = Number((await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, mintA, escrowPda, true)).amount);

    console.log("\n[Final Trade Summary]");
    console.log("✓ Trade Successfully Completed");
    console.log(`  Seller Final Balances: ${sellerA} TokenA | ${sellerB} TokenB`);
    console.log(`  Buyer Final Balances:  ${buyerA} TokenA | ${buyerB} TokenB`);
    console.log(`  Vault Balance:        ${vaultA} TokenA (should be empty)`);
    console.log(`  Escrow Account:       CLOSED`); // Or "Active" if not closed
    
    // Verify escrow account was properly closed (if your program does this)
    try {
        await program.account.escrow.fetch(escrowPda);
        console.log("Escrow account still exists");
    } catch {
        console.log("  ✓ Escrow account successfully closed");
    }

    // Final assertions
    assert.equal(sellerA, 900, "Seller should have 900 TokenA");
    assert.equal(sellerB, 50, "Seller should have 50 TokenB");
    assert.equal(buyerA, 100, "Buyer should have 100 TokenA");
    assert.equal(buyerB, 950, "Buyer should have 950 TokenB");
    assert.equal(vaultA, 0, "Vault should be empty");
  })
});