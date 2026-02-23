import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });
import { fetchActiveReferenda } from "./subsquare.js";
import { analyzeProposal } from "./analyzer.js";
import {
  publishAnalysis,
  hasExistingAnalysis,
  getOracleAddress,
} from "./contracts.js";

async function main() {
  console.log("=== GovMind AI Backend ===\n");
  console.log(`Oracle wallet: ${getOracleAddress()}`);

  // Validate env
  if (!process.env.PRIVATE_KEY) {
    console.error("Missing PRIVATE_KEY in .env");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  // Fetch proposals
  console.log("\nFetching active referenda...");
  const proposals = await fetchActiveReferenda(5);
  console.log(`Found ${proposals.length} referenda to process\n`);

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const proposal of proposals) {
    console.log(`--- Referendum #${proposal.referendumIndex} ---`);
    console.log(`  Title: ${proposal.title}`);
    console.log(`  Track: ${proposal.trackName} (${proposal.track})`);
    console.log(`  State: ${proposal.state}`);
    if (proposal.tally?.ayes > 0 || proposal.tally?.nays > 0) {
      console.log(`  Tally: ${proposal.tally.ayePercent}% Aye (${proposal.tally.ayes.toLocaleString()} DOT) vs ${proposal.tally.nays.toLocaleString()} DOT Nay`);
    }
    if (proposal.commentAnalysis?.total > 0) {
      console.log(`  Discussion: ${proposal.commentAnalysis.summary}`);
    }
    if (proposal.spendingInfo?.totalAmountDOT > 0) {
      console.log(`  Requesting: ${proposal.spendingInfo.totalAmountDOT.toLocaleString()} DOT in ${proposal.spendingInfo.paymentCount} tranches`);
    }

    try {
      // Check if already on-chain
      const exists = await hasExistingAnalysis(proposal.referendumIndex);
      if (exists) {
        console.log("  Already analyzed on-chain, skipping.\n");
        skipped++;
        continue;
      }

      // AI analysis
      console.log("  Analyzing with GPT...");
      const analysis = await analyzeProposal(proposal);

      const recLabel =
        analysis.recommendation === 1
          ? "AYE"
          : analysis.recommendation === -1
            ? "NAY"
            : "ABSTAIN";

      console.log(
        `  Result: ${recLabel} | Risk: ${analysis.riskScore}/100 | Confidence: ${analysis.confidence}/100`
      );
      console.log(`  Summary: ${analysis.summary}`);

      // Publish on-chain
      console.log("  Publishing to AIOracle...");
      const receipt = await publishAnalysis(
        proposal.referendumIndex,
        proposal.track,
        analysis
      );

      if (receipt) {
        analyzed++;
      } else {
        skipped++;
      }

      // Delay between transactions to avoid nonce issues
      if (proposals.indexOf(proposal) < proposals.length - 1) {
        console.log("  Waiting 3s before next proposal...\n");
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.error(`  FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Analyzed & published: ${analyzed}`);
  console.log(`  Skipped (existing):   ${skipped}`);
  console.log(`  Failed:               ${failed}`);
  console.log(
    `\nVerify on explorer: https://blockscout-testnet.polkadot.io/address/${process.env.AI_ORACLE_ADDRESS || "0x0D32685A3b5F3618B8bd6B8f22e748E50144b7EE"}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
