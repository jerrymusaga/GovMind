/**
 * Change Detection Engine
 *
 * Detects significant changes in Subsquare data that warrant re-analysis:
 * - New comments with concerns or endorsements
 * - Tally swing exceeding threshold
 * - Status change (e.g., Deciding → Confirming)
 * - Proposal content edited
 *
 * Uses an in-memory snapshot store. In production, this would be persisted.
 */

// In-memory snapshots of last-analyzed state per referendum
const snapshots = new Map();

// Thresholds for triggering re-analysis
const THRESHOLDS = {
  TALLY_SWING_PERCENT: 10,       // Re-analyze if aye% swings by more than 10 points
  NEW_COMMENTS_MIN: 2,           // Re-analyze if 2+ new comments since last analysis
  NEW_CONCERN_COMMENTS: 1,       // Re-analyze if any new negative sentiment comment
  STATUS_CHANGE: true,           // Always re-analyze on status change
};

/**
 * Save a snapshot of the current proposal state after analysis
 */
export function saveSnapshot(proposal) {
  snapshots.set(proposal.referendumIndex, {
    commentsCount: proposal.commentsCount || 0,
    negativeSentiment: proposal.commentAnalysis?.sentiments?.negative || 0,
    ayePercent: proposal.tally?.ayePercent || 0,
    status: proposal.state || "Unknown",
    savedAt: Date.now(),
  });
}

/**
 * Check if a proposal has changed significantly since last analysis
 * Returns { changed: boolean, reasons: string[] }
 */
export function detectChanges(proposal) {
  const snap = snapshots.get(proposal.referendumIndex);
  const reasons = [];

  // No previous snapshot → this is a first analysis, not a change
  if (!snap) {
    return { changed: false, reasons: [] };
  }

  // 1. Status change (e.g., Deciding → Confirming → Executed)
  if (THRESHOLDS.STATUS_CHANGE && proposal.state !== snap.status) {
    reasons.push(`Status changed: ${snap.status} → ${proposal.state}`);
  }

  // 2. New comments
  const currentComments = proposal.commentsCount || 0;
  const newComments = currentComments - snap.commentsCount;
  if (newComments >= THRESHOLDS.NEW_COMMENTS_MIN) {
    reasons.push(`${newComments} new comments (${snap.commentsCount} → ${currentComments})`);
  }

  // 3. New negative/concern comments
  const currentNegative = proposal.commentAnalysis?.sentiments?.negative || 0;
  const newNegative = currentNegative - snap.negativeSentiment;
  if (newNegative >= THRESHOLDS.NEW_CONCERN_COMMENTS) {
    reasons.push(`${newNegative} new concern comments`);
  }

  // 4. Tally swing
  const currentAye = proposal.tally?.ayePercent || 0;
  const swing = Math.abs(currentAye - snap.ayePercent);
  if (swing >= THRESHOLDS.TALLY_SWING_PERCENT) {
    reasons.push(`Tally swing: ${snap.ayePercent}% → ${currentAye}% (${swing > 0 ? "+" : ""}${currentAye - snap.ayePercent}pp)`);
  }

  return {
    changed: reasons.length > 0,
    reasons,
  };
}

/**
 * Check if enough time has passed since last analysis to avoid spam
 * Returns true if at least `minIntervalMs` has passed
 */
export function cooldownExpired(referendumIndex, minIntervalMs = 5 * 60 * 1000) {
  const snap = snapshots.get(referendumIndex);
  if (!snap) return true;
  return Date.now() - snap.savedAt >= minIntervalMs;
}
