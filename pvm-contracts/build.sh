#!/bin/bash
# Build both Rust PVM contracts for GovMind
# Requires: nightly-2024-11-19 toolchain + rust-src + polkatool

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Building GovMind PVM Contracts (Rust → RISC-V → PolkaVM)"
echo "========================================================="

# Build SCALE Codec
echo ""
echo "[1/2] Building SCALE Codec PVM contract..."
cd "$SCRIPT_DIR/scale-codec"
cargo +nightly-2024-11-19 build --release 2>&1
polkatool link --run-only-if-newer \
  -s target/riscv64emac-unknown-none-polkavm/release/scale-codec-pvm \
  -o scale-codec.polkavm
SIZE=$(wc -c < scale-codec.polkavm | tr -d ' ')
echo "      scale-codec.polkavm: ${SIZE} bytes"

# Build Alignment Scorer
echo ""
echo "[2/2] Building Alignment Scorer PVM contract..."
cd "$SCRIPT_DIR/alignment-scorer"
cargo +nightly-2024-11-19 build --release 2>&1
polkatool link --run-only-if-newer \
  -s target/riscv64emac-unknown-none-polkavm/release/alignment-scorer \
  -o alignment-scorer.polkavm
SIZE=$(wc -c < alignment-scorer.polkavm | tr -d ' ')
echo "      alignment-scorer.polkavm: ${SIZE} bytes"

echo ""
echo "Done. Both PVM contracts compiled to RISC-V."
echo ""
echo "Binaries:"
echo "  pvm-contracts/scale-codec/scale-codec.polkavm"
echo "  pvm-contracts/alignment-scorer/alignment-scorer.polkavm"
