#!/usr/bin/env node
/**
 * Batch Analyzer — Pre-analyze all active referenda and publish on-chain.
 * Run once locally before demo to populate on-chain data.
 *
 * Usage: node batch-analyze.js [--limit 20] [--dry-run]
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { fetchActiveReferenda, fetchHistoricalPrecedents } from "./subsquare.js";
import { analyzeProposal } from "./analyzer.js";
import { publishAnalysis, hasExistingAnalysis } from "./contracts.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 20;

async function main() {
  console.log("=== GovMind Batch Analyzer ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no on-chain writes)" : "LIVE (publishing on-chain)"}`);
  console.log(`Force: ${force ? "YES (re-analyzing all)" : "NO (skipping existing)"}`);
  console.log(`Limit: ${limit} proposals\n`);

  // Fetch active referenda
  console.log("Fetching active referenda from Subsquare...");
  const proposals = await fetchActiveReferenda(limit);
  console.log(`Found ${proposals.length} proposals\n`);

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const proposal of proposals) {
    const id = proposal.referendumIndex;
    console.log(`\n── Referendum #${id}: ${proposal.title} ──`);
    console.log(`   Track: ${proposal.trackName} | State: ${proposal.state}`);

    // Check if already on-chain
    if (!force) {
      try {
        const exists = await hasExistingAnalysis(id);
        if (exists) {
          console.log(`   ✓ Already on-chain, skipping (use --force to re-analyze)`);
          skipped++;
          continue;
        }
      } catch (err) {
        console.warn(`   Warning: Could not check on-chain status: ${err.message}`);
      }
    }

    // AI analysis
    try {
      console.log(`   Analyzing with AI...`);
      const historicalData = await fetchHistoricalPrecedents(proposal, 3);
      const analysis = await analyzeProposal(proposal, historicalData);

      const rec = analysis.recommendation === 1 ? "AYE" : analysis.recommendation === -1 ? "NAY" : "ABSTAIN";
      console.log(`   Result: ${rec} | Risk: ${analysis.riskScore}/100 | Confidence: ${analysis.confidence}/100`);

      if (dryRun) {
        console.log(`   [DRY RUN] Would publish on-chain`);
        analyzed++;
        continue;
      }

      // Publish on-chain with delay between transactions
      console.log(`   Publishing on-chain...`);
      const receipt = await publishAnalysis(id, proposal.track, analysis, { force });
      if (receipt) {
        console.log(`   ✓ Published in block ${receipt.blockNumber} (tx: ${receipt.hash})`);
        analyzed++;
      } else {
        console.log(`   ✓ Already existed on-chain`);
        skipped++;
      }

      // Wait between transactions to avoid nonce conflicts
      console.log(`   Waiting 5s before next...`);
      await new Promise((r) => setTimeout(r, 5000));
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}`);
      failed++;
      // Wait longer after failures
      await new Promise((r) => setTimeout(r, 8000));
    }
  }

  console.log(`\n=== Batch Complete ===`);
  console.log(`Analyzed: ${analyzed}`);
  console.log(`Skipped (already on-chain): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${proposals.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
