# Tournament End — Manual Test Checklist

Use this to verify winner flow triggers reliably (including during dev test cycles).

## Prerequisites

- Two test accounts (A and B).
- **Cron (production):** Schedule `run_tournament_cycle_end()` every minute so ended cycles are finalized (winners awarded) and the next cycle starts. Without this, the UI shows "Ended" but no results are processed.
- Dev: "Start 1-min test cycle (dev)" runs the **full finalize flow** (finalize current cycle → award top 3 → then end timer and reset).

## Checklist

### 1. Foreground — timer hits 0 while in app

- [ ] Account A and B both enter the same tournament (e.g. Biggest Fish).
- [ ] Account A stays on **Compete** (tournament detail) with countdown visible.
- [ ] Wait for countdown to reach **0** (or use "Start 1-min test cycle (dev)" and wait 1 min).
- [ ] **Expected:** Winner modal appears for A (and for B when B is on app) with placement (1st/2nd/3rd), XP, trophy.
- [ ] Dismiss modal. **Expected:** XP and trophy badge are present; reopening app does **not** show the modal again (no double award).

### 2. Return to app after end

- [ ] Account A enters tournament; then **backgrounds the app** (home or switch app) before the countdown ends.
- [ ] Wait until tournament has ended (e.g. 1 min after dev cycle end).
- [ ] **Reopen the app** (foreground).
- [ ] **Expected:** Winner modal appears shortly (or on next poll within ~12s) with correct placement and award.
- [ ] **Expected:** Only one award (XP/badge) and modal shows exactly once.

### 3. Cold start after end

- [ ] Account B enters tournament.
- [ ] **Force-close the app** (swipe away).
- [ ] Wait until tournament has ended.
- [ ] **Open the app from cold start** (no process in memory).
- [ ] **Expected:** After auth/session is ready, winner flow runs (on mount + optional poll); winner modal appears with placement and award.
- [ ] **Expected:** XP and trophy badge are correct; no double award on next open.

### 4. No double award

- [ ] Complete any of the flows above so the user has been awarded (modal shown and dismissed).
- [ ] Switch tabs (e.g. Home → Compete → Profile) and back.
- [ ] Background and foreground the app again.
- [ ] **Expected:** Winner modal does **not** appear again; XP/badge count unchanged (idempotent: `trophy_badges` unique + `claim_tournament_win` returns `claimed`).

### 5. Dev test cycle uses same path

- [ ] Use "Start 1-min test cycle (dev)" to end the tournament early.
- [ ] **Expected:** Same winner flow as natural end (modal, XP, badge).
- [ ] **Expected:** No separate or bypass logic; `claim_tournament_win` RPC is used for both natural and dev-forced end.

---

## Implementation summary

- **Backend finalization (required):** When a tournament cycle ends, a **server** must run:
  1. `finalize_ended_tournaments()` — ranks entries, awards top 3 (trophy_badges, tournament_results, profiles).
  2. `reset_expired_tournaments()` — advances cycle (last_ended_cycle_id, new cycle_ends_at).
  - **Cron:** Schedule `SELECT run_tournament_cycle_end();` every minute (pg_cron or Edge Function). That function runs finalize then reset.
- **Client:** `useTournamentWinCheck` detects ended cycles (where `last_ended_cycle_id` is set) and calls `claim_tournament_win(tournament_id)` so the user sees the winner modal; claim is idempotent (returns `claimed` if server already awarded).
- **Dev button:** "Start 1-min test cycle" calls `force_restart_tournament('biggest_fish', 1)`, which now **finalizes the current cycle** (awards top 3), then ends the timer and runs reset.
- **Logs:** `devLog` only (see `[TournamentEndService]` in console when `isDev`).
