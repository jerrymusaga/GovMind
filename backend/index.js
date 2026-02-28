import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { getOracleAddress } from "./contracts.js";
import { startApiServer } from "./api.js";

async function main() {
  console.log("=== GovMind AI Backend ===");
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

  // Start API server — all analysis is on-demand
  const API_PORT = Number(process.env.API_PORT) || 3001;
  startApiServer(API_PORT);

  console.log("\nMode: ON-DEMAND ANALYSIS");
  console.log("  POST /api/analyze/:id  — User-triggered AI analysis + publish on-chain");
  console.log("  On-chain reads handled by the frontend directly via contract calls");
  console.log("  Re-analysis triggered when proposal data has materially changed\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
