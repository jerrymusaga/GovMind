import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { fetchActiveReferenda } from "./subsquare.js";
import { analyzeProposal } from "./analyzer.js";
import {
  publishAnalysis,
  updateOnChainAnalysis,
  hasExistingAnalysis,
  getOnChainAnalysis,
  getOracleAddress,
} from "./contracts.js";
import { detectChanges, saveSnapshot, cooldownExpired } from "./detector.js";

// Polling interval: 5 minutes (set via env or default)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000;
const RUN_ONCE = process.argv.includes("--once");

async function runCycle() {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`=== GovMind Analysis Cycle — ${new Date().toLocaleTimeString()} ===`);
  console.log(`${"=".repeat(50)}\n`);

  // Fetch proposals with enriched Polkassembly data
  console.log("Fetching active referenda from Polkassembly...");
  const proposals = await fetchActiveReferenda(5);
  console.log(`Found ${proposals.length} referenda to process\n`);

  let analyzed = 0;
  let updated = 0;
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
      const exists = await hasExistingAnalysis(proposal.referendumIndex);

      if (!exists) {
        // === FIRST ANALYSIS ===
        console.log("  [NEW] Analyzing with GPT...");
        const analysis = await analyzeProposal(proposal);
        logAnalysis(analysis);

        console.log("  Publishing to AIOracle...");
        const receipt = await publishAnalysis(
          proposal.referendumIndex,
          proposal.track,
          analysis
        );

        if (receipt) {
          analyzed++;
          saveSnapshot(proposal);
        } else {
          skipped++;
        }
      } else {
        // === CHECK FOR CHANGES ===
        const { changed, reasons } = detectChanges(proposal);

        if (changed && cooldownExpired(proposal.referendumIndex)) {
          console.log(`  [CHANGE DETECTED] Re-analyzing...`);
          for (const reason of reasons) {
            console.log(`    → ${reason}`);
          }

          const analysis = await analyzeProposal(proposal);
          logAnalysis(analysis);

          // Compare with on-chain to see if update is worthwhile
          const onChain = await getOnChainAnalysis(proposal.referendumIndex);
          const recChanged = onChain && onChain.recommendation !== analysis.recommendation;
          const riskDelta = onChain ? Math.abs(onChain.riskScore - analysis.riskScore) : 0;
          const confDelta = onChain ? Math.abs(onChain.confidence - analysis.confidence) : 0;

          // Only push update if recommendation flipped OR risk/confidence shifted significantly
          if (recChanged || riskDelta >= 10 || confDelta >= 15) {
            console.log(`  Publishing update to AIOracle...`);
            if (recChanged) {
              const oldLabel = recLabel(onChain.recommendation);
              const newLabel = recLabel(analysis.recommendation);
              console.log(`  RECOMMENDATION CHANGED: ${oldLabel} → ${newLabel}`);
            }

            const receipt = await updateOnChainAnalysis(
              proposal.referendumIndex,
              analysis,
              onChain.version
            );

            if (receipt) {
              updated++;
              saveSnapshot(proposal);
            }
          } else {
            console.log(`  Changes detected but analysis delta too small, skipping update.`);
            saveSnapshot(proposal); // Still save snapshot to track new state
            skipped++;
          }
        } else if (changed) {
          console.log(`  Changes detected but cooldown active, will retry next cycle.`);
          skipped++;
        } else {
          console.log("  No significant changes detected, skipping.\n");
          saveSnapshot(proposal); // Keep snapshot fresh
          skipped++;
        }
      }

      // Delay between transactions to avoid nonce issues
      if (proposals.indexOf(proposal) < proposals.length - 1) {
        console.log("  Waiting 3s...\n");
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.error(`  FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log("\n=== Cycle Summary ===");
  console.log(`  New analyses:     ${analyzed}`);
  console.log(`  Re-analyses:      ${updated}`);
  console.log(`  Skipped:          ${skipped}`);
  console.log(`  Failed:           ${failed}`);
  console.log(
    `\nExplorer: https://blockscout-testnet.polkadot.io/address/${process.env.AI_ORACLE_ADDRESS || "0x0D32685A3b5F3618B8bd6B8f22e748E50144b7EE"}`
  );

  return { analyzed, updated, skipped, failed };
}

function logAnalysis(analysis) {
  console.log(
    `  Result: ${recLabel(analysis.recommendation)} | Risk: ${analysis.riskScore}/100 | Confidence: ${analysis.confidence}/100`
  );
  console.log(`  Summary: ${analysis.summary}`);
}

function recLabel(rec) {
  return rec === 1 ? "AYE" : rec === -1 ? "NAY" : "ABSTAIN";
}

async function main() {
  console.log("=== GovMind AI Backend ===");
  console.log(`Oracle wallet: ${getOracleAddress()}`);
  console.log(`Mode: ${RUN_ONCE ? "Single run" : `Polling every ${POLL_INTERVAL_MS / 1000}s`}`);

  // Validate env
  if (!process.env.PRIVATE_KEY) {
    console.error("Missing PRIVATE_KEY in .env");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in .env");
    process.exit(1);
  }

  // Run first cycle
  await runCycle();

  // If --once flag, exit after single run
  if (RUN_ONCE) {
    console.log("\n--once flag set, exiting.");
    return;
  }

  // Otherwise, start polling loop
  console.log(`\nNext cycle in ${POLL_INTERVAL_MS / 1000}s... (Ctrl+C to stop)\n`);
  setInterval(async () => {
    try {
      await runCycle();
      console.log(`\nNext cycle in ${POLL_INTERVAL_MS / 1000}s...\n`);
    } catch (err) {
      console.error("Cycle failed:", err.message);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
