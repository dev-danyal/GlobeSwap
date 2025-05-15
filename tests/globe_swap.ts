import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, SystemProgram, Keypair, Transaction } from "@solana/web3.js";
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
import fs from 'fs';

// Load devnet wallet
const walletKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync("wallet.json", "utf-8")))
);

// Helper functions
async function safeGetTokenBalance(
  connection: anchor.web3.Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<number> {
  try {
    const account = await getAssociatedTokenAddress(mint, owner);
    const accountInfo = await connection.getAccountInfo(account);
    if (!accountInfo) return 0;
    
    // Directly parse token account data
    const data = Buffer.from(accountInfo.data);
    return Number(data.readBigUInt64LE(64)); // Balance is at offset 64
  } catch {
    return 0;
  }
}

async function confirmTx(connection: anchor.web3.Connection, signature: string) {
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, "confirmed");
}

async function airdrop(connection: anchor.web3.Connection, address: PublicKey, amount: number) {
  const sig = await connection.requestAirdrop(
    address,
    amount * anchor.web3.LAMPORTS_PER_SOL
  );
  await confirmTx(connection, sig);
}

describe("GlobeSwap - Devnet Test", () => {
  // Setup devnet connection
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    { commitment: "confirmed" }
  );
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.GlobeSwap as Program<GlobeSwap>;
  const seller = provider.wallet.publicKey;
  let buyer: Keypair;
  
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
  let vaultAta: PublicKey;

  // Trade parameters
  const DECIMALS = 6;
  const seed = new anchor.BN(777);
  const receiveAmt = new anchor.BN(50 * 10**DECIMALS);
  const depositAmt = new anchor.BN(100 * 10**DECIMALS);

  before(async function() {
    this.timeout(120000); // 2 min setup timeout

    try {
      console.log("\n=== Setting up test environment ===");
      
      // 1. Setup buyer
      buyer = Keypair.generate();
      await airdrop(connection, buyer.publicKey, 1);
      console.log(`Buyer account: ${buyer.publicKey.toString()}`);

      // 2. Create tokens
      mintA = await createMint(
        connection,
        walletKeypair,
        seller,
        null,
        DECIMALS
      );
      mintB = await createMint(
        connection,
        walletKeypair,
        seller,
        null,
        DECIMALS
      );
      console.log(`Created tokens: 
        TokenA: ${mintA.toString()}
        TokenB: ${mintB.toString()}`);

      // 3. Create token accounts
      sellerTokenA = await getAssociatedTokenAddress(mintA, seller);
      buyerTokenB = await getAssociatedTokenAddress(mintB, buyer.publicKey);
      makerReceiveTokenB = await getAssociatedTokenAddress(mintB, seller);
      buyerReceiveTokenA = await getAssociatedTokenAddress(mintA, buyer.publicKey);

      await getOrCreateAssociatedTokenAccount(
        connection,
        walletKeypair,
        mintA,
        seller
      );
      await getOrCreateAssociatedTokenAccount(
        connection,
        walletKeypair,
        mintB,
        buyer.publicKey
      );

      // 4. Mint initial tokens
      const initialMintAmount = 1000 * 10**DECIMALS;
      await mintTo(
        connection,
        walletKeypair,
        mintA,
        sellerTokenA,
        seller,
        initialMintAmount
      );
      await mintTo(
        connection,
        walletKeypair,
        mintB,
        buyerTokenB,
        seller,
        initialMintAmount
      );

      // 5. Setup escrow
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), seller.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      vaultAta = await getAssociatedTokenAddress(mintA, escrowPda, true);

      console.log("Setup completed successfully\n");
    } catch (error) {
      console.error("Setup failed:", error);
      throw error;
    }
  });

  it("1. Initialize trade - seller deposits TokenA", async function() {
    this.timeout(60000);

    try {
      console.log("\n=== Initializing Trade ===");
      
      // Create vault if needed
      try {
        await getOrCreateAssociatedTokenAccount(
          connection,
          walletKeypair,
          mintA,
          escrowPda,
          true
        );
      } catch {}

      const initialBalance = await safeGetTokenBalance(connection, mintA, seller);
      console.log(`Seller initial balance: ${initialBalance / 10**DECIMALS} TokenA`);

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

      await confirmTx(connection, tx);
      console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      const postBalance = await safeGetTokenBalance(connection, mintA, seller);
      const vaultBalance = await safeGetTokenBalance(connection, mintA, escrowPda);

      console.log(`Seller new balance: ${postBalance / 10**DECIMALS} TokenA`);
      console.log(`Vault balance: ${vaultBalance / 10**DECIMALS} TokenA`);

      assert.isAtLeast(
        initialBalance - postBalance,
        depositAmt.toNumber() - 1000, // Allow 1000 lamport margin
        "Seller didn't deposit enough tokens"
      );
      assert.isAtLeast(
        vaultBalance,
        depositAmt.toNumber() - 1000,
        "Vault didn't receive correct amount"
      );

    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  it("2. Complete trade - buyer deposits TokenB", async function() {
    this.timeout(60000);

    try {
      console.log("\n=== Completing Trade ===");

      const initialBuyerB = await safeGetTokenBalance(connection, mintB, buyer.publicKey);
      const initialSellerB = await safeGetTokenBalance(connection, mintB, seller);
      console.log(`Initial balances:
        Buyer TokenB: ${initialBuyerB / 10**DECIMALS}
        Seller TokenB: ${initialSellerB / 10**DECIMALS}`);

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

      await confirmTx(connection, tx);
      console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      const finalBuyerB = await safeGetTokenBalance(connection, mintB, buyer.publicKey);
      const finalSellerB = await safeGetTokenBalance(connection, mintB, seller);
      const finalBuyerA = await safeGetTokenBalance(connection, mintA, buyer.publicKey);
      const vaultBalance = await safeGetTokenBalance(connection, mintA, escrowPda);

      console.log(`Final balances:
        Buyer TokenA: ${finalBuyerA / 10**DECIMALS}
        Buyer TokenB: ${finalBuyerB / 10**DECIMALS}
        Seller TokenB: ${finalSellerB / 10**DECIMALS}
        Vault: ${vaultBalance / 10**DECIMALS} TokenA`);

      assert.isAtLeast(
        initialBuyerB - finalBuyerB,
        receiveAmt.toNumber() - 1000,
        "Buyer didn't send enough TokenB"
      );
      assert.isAtLeast(
        finalSellerB - initialSellerB,
        receiveAmt.toNumber() - 1000,
        "Seller didn't receive enough TokenB"
      );
      assert.isAtLeast(
        finalBuyerA,
        depositAmt.toNumber() - 1000,
        "Buyer didn't receive enough TokenA"
      );
      assert.equal(vaultBalance, 0, "Vault should be empty");

    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  it("3. Verify final state", async function() {
    this.timeout(30000);

    try {
      console.log("\n=== Verifying Final State ===");

      // Check escrow state
      try {
        const escrow = await program.account.escrow.fetch(escrowPda);
        console.log(`Escrow state:
          Maker: ${escrow.maker.toString()}
          Taker: ${escrow.taker?.toString() || "None"}`);
      } catch {
        console.log("Escrow account closed");
      }

      // Final balances
      const sellerA = await safeGetTokenBalance(connection, mintA, seller);
      const sellerB = await safeGetTokenBalance(connection, mintB, seller);
      const buyerA = await safeGetTokenBalance(connection, mintA, buyer.publicKey);
      const buyerB = await safeGetTokenBalance(connection, mintB, buyer.publicKey);

      console.log(`Final token balances:
        Seller: ${sellerA / 10**DECIMALS} TokenA | ${sellerB / 10**DECIMALS} TokenB
        Buyer: ${buyerA / 10**DECIMALS} TokenA | ${buyerB / 10**DECIMALS} TokenB`);
    } catch (error) {
      console.error("Verification failed:", error);
      throw error;
    }
  });
});

