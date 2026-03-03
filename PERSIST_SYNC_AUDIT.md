# Persist + Sync Audit — Checklist Results

Audit of the Trophy/Snagged app against the "Make Everything Persist + Sync for All Users" checklist.

---

## 1) Data Model Audit (Tables + Relationships)

### Tables that exist

| Table | Status | Notes |
|-------|--------|-------|
| **profiles** | ✅ | 1:1 with auth.users; has username, display_name, avatar_url, banner_url, etc. |
| **catches** | ✅ | Logbook entries (user_id, species, weight, photo_url, etc.) |
| **feed_posts** | ✅ | Global feed; has hype_count, comment_count, share_count |
| **feed_post_hypes** | ✅ | Unique (post_id, user_id) — likes |
| **feed_comments** | ✅ | Comments with post_id, user_id, parent_comment_id |
| **feed shares** | ⚠️ | No `shares` table; share_count is a column on feed_posts, incremented via RPC |
| **friendships** | ✅ | user_id_1, user_id_2, status, requested_by |
| **tournaments** | ✅ | id, type, title, metric_type, ends_at |
| **tournament_entries** | ✅ | UNIQUE(tournament_id, user_id), image_url, up_votes, down_votes |
| **tournament_entry_votes** | ✅ | PRIMARY KEY (entry_id, user_id), vote IN ('UP','DOWN') |
| **tournament_results** | ✅ | Snapshot for winners; user_id, place, seen_at |
| **notifications** | ❌ | **MISSING** — no generic notifications table; only tournament_results for "result" notifications |
| **post_photos** | N/A | Single photo per post (photo_path + photo_url on feed_posts) |
| **reactions** | N/A | Use `feed_post_hypes` (same concept) |
| **votes** | N/A | Use `tournament_entry_votes` for tournament; no separate post up/down votes |

### Gaps

- **notifications** table does not exist — needed for in-app notifications (later push-ready)
- **shares** table is optional; current design uses share_count on feed_posts + `increment_feed_share` RPC

---

## 2) RLS + Policies (Per Table)

### profiles
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public read | ✅ |
| INSERT | auth.uid() = id | ✅ |
| UPDATE | auth.uid() = id | ✅ |

### feed_posts
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public | ✅ |
| INSERT | auth.uid() = user_id | ✅ |
| UPDATE | auth.uid() = user_id | ✅ |
| DELETE | auth.uid() = user_id | ✅ |

### feed_post_hypes
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public | ✅ |
| INSERT | auth.uid() = user_id | ✅ |
| DELETE | auth.uid() = user_id | ✅ |
| UPDATE | N/A (toggle = insert/delete) | OK |

### feed_comments
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public | ✅ |
| INSERT | auth.uid() = user_id | ✅ |
| UPDATE | — | ❌ Missing (edit/delete own comment) |
| DELETE | — | ❌ Missing (delete own comment) |

### tournament_entries
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public | ✅ |
| INSERT | auth.uid() = user_id | ✅ |
| UPDATE | auth.uid() = user_id | ✅ |
| DELETE | auth.uid() = user_id | ✅ |

### tournament_entry_votes
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | Public | ✅ |
| INSERT | auth.uid() = user_id | ✅ |
| UPDATE | auth.uid() = user_id | ✅ |
| DELETE | auth.uid() = user_id | ✅ |

### tournament_results
| Action | Policy | Status |
|--------|--------|--------|
| SELECT | auth.uid() = user_id | ✅ |
| INSERT | service_role only | ✅ |
| UPDATE | auth.uid() = user_id (mark seen) | ✅ |

### catches, friendships, messages, leaderboard_entries, weekly_badges, generation_usage
All have appropriate RLS policies for their use cases.

---

## 3) Storage Uploads (blob:// + ph:// issues)

### Current state

- **blob:** — `isValidImageUri()` rejects blob: for display. Good.
- **ph://** — `createFeedPost` treats only `file://` and `content://` as local. **ph:// is NOT treated as local** → risk of storing ph:// in DB if ImagePicker returns it on iOS.
- **localhost** — Rejected by `isValidImageUri`.

### Fixes required

1. **createFeedPost** — Add `ph://` and `ph-upload://` to `isLocal` check so local URIs are uploaded to Storage before insert.
2. **insertFeedPost / createFeedPost** — Add validation to reject `blob:`, `localhost`, `ph://` before writing to DB. Only persist storage paths or https URLs.

### Storage buckets

- `media` bucket exists with RLS: owner-scoped upload/update/delete, public read.
- Paths: `{userId}/stories/{id}.jpg`, `{userId}/avatars/main.jpg`, `{userId}/banners/main.jpg`, `{userId}/catches/{id}.jpg`, `{userId}/posts/{id}.jpg`.

---

## 4) Global Feed Correctness

### Current feed query

- `getFeedPostsForHome(limit=50)` — order by `created_at` desc, limit 50.
- No pagination (offset/cursor).
- No friends-first; universal feed only.
- Counts (hype_count, comment_count) come from DB columns (server-side) ✅

### Gaps

- No cursor-based pagination.
- No friends-first feed option.
- `isHyped` is always `false` — `rowToFeedPost` does not join `feed_post_hypes` for current user.
- `share_count` exists in DB but `FeedPostRow` interface and `rowToFeedPost` do not include it.

---

## 5) Likes (Hype), Votes, Comments, Shares — Persistence

### Hype (likes)

- **DB:** `feed_post_hypes` + `hype_feed_post` RPC exist.
- **App:** `FeedContext.handlePostHype` **only updates local state** — never calls `hype_feed_post` RPC. ❌ **Not persisted.**

### Comments

- **DB:** `feed_comments` + `add_feed_comment` RPC exist.
- **App:** `FeedContext.handleAddComment` **only updates local state** — never calls `add_feed_comment` RPC. ❌ **Not persisted.**

### Shares

- **DB:** `increment_feed_share` RPC exists.
- **App:** `FeedPostCard.handleShare` navigates to friends; no Share.share for post, no RPC call. ❌ Share count never incremented for feed posts.

### Tournament votes

- **DB:** `vote_on_tournament_entry` RPC used.
- **App:** `tournamentDb.ts` calls the RPC. ✅ Persisted.

### Unique constraints

- `feed_post_hypes`: PRIMARY KEY (post_id, user_id) ✅
- `tournament_entry_votes`: PRIMARY KEY (entry_id, user_id) ✅

---

## 6) Tournaments

- Entries: persisted via `tournament_entries`.
- Leaderboard: from DB (`tournament_entries` ordered by votes/metric).
- Results: `tournament_results` table; inserted by service/cron when tournament ends.
- Result modal: triggered by unseen `tournament_results` rows (DB-driven). ✅

---

## 7) Profiles

- Profiles read from Supabase; edits use `updateUserProfile`.
- Banner/avatar upload to Storage, path saved to profiles.
- Username unique constraint exists.

---

## 8) Realtime / Refresh

- No Supabase Realtime subscriptions for feed.
- `refreshFeed` on FeedProvider mount.
- `useFocusEffect` used on profile and other screens for refetch.
- Pull-to-refresh: check home feed component.

---

## 9) Error Handling

- No shared `dbWrite()` helper.
- Writes use try/catch and `console.error`.
- Some optimistic updates (e.g. hype) without rollback.

---

## 10) Auth Session

- Supabase client uses `autoRefreshToken`, `persistSession`.
- Policies use `auth.uid()`.

---

## 11) QA Test Script (Summary)

| Test | Expected | Current |
|------|----------|---------|
| User A posts → User B sees | Yes | ✅ (if feed refresh) |
| User B likes → User A sees count | Yes | ❌ Likes not persisted |
| User B comments → User A sees | Yes | ❌ Comments not persisted |
| Tournament entry A → B sees | Yes | ✅ |
| Profile edit → other user sees | Yes | ✅ |
| Kill app / reopen | Data persists | ✅ for posts, tournaments; ❌ hype/comments lost |
| Log out / in | Data persists | Same |

---

## 12) Deliverables

### A. Tables + Columns + Constraints (Key)

| Table | Key Columns | Constraints |
|-------|-------------|-------------|
| profiles | id, display_name, username, avatar_url, banner_url | username UNIQUE |
| feed_posts | id, user_id, photo_path, photo_url, hype_count, comment_count, share_count | — |
| feed_post_hypes | post_id, user_id | PRIMARY KEY (post_id, user_id) |
| feed_comments | id, post_id, user_id, text, parent_comment_id | — |
| tournament_entries | id, tournament_id, user_id, image_url, up_votes, down_votes | UNIQUE(tournament_id, user_id) |
| tournament_entry_votes | entry_id, user_id, vote | PRIMARY KEY (entry_id, user_id), vote IN ('UP','DOWN') |
| tournament_results | id, tournament_id, user_id, place, seen_at | place IN (1,2,3) |

### B. RLS Policies

See section 2 above.

### C. blob:// Fixes

1. **createFeedPost** — treat `ph://` and `ph-upload://` as local; upload before insert.
2. **Validation** — reject `blob:`, `localhost`, `ph://` before writing photo_url/photo_path to DB.

### D. Verified Feed Queries

- `getFeedPostsForHome`: server-driven, newest first. Missing: pagination, friends-first, isHyped from DB.

### E. Verified Like/Vote/Comment Logic

- **Hype:** RPC exists; app does not call it. **Fix:** Wire `handlePostHype` to `hype_feed_post`.
- **Comments:** RPC exists; app does not call it. **Fix:** Wire `handleAddComment` to `add_feed_comment`.
- **Share:** RPC exists; app does not call it when sharing a post. **Fix:** Call `increment_feed_share` when user shares a post (e.g. via Share.share with post URL).

### F. Known Issues

1. **Hype and comments are client-only** — not persisted; other users never see them.
2. **Share count never incremented** — no call to `increment_feed_share`.
3. **ph:// URIs** — can be stored in DB if ImagePicker returns them; upload path doesn’t treat them as local.
4. **No notifications table** — in-app notifications not supported.
5. **feed_comments** — no UPDATE/DELETE policies for users to edit/delete own comments.
6. **isHyped** — not fetched from `feed_post_hypes`; always false after refresh.
7. **No feed pagination** — fixed limit 50.
8. **No friends-first feed** — only global feed.

---

## Recommended Implementation Order

1. **Wire hype/comment/share RPCs** — Add Supabase client wrappers and call them from FeedContext; update UI from RPC response.
2. **Fetch isHyped** — Join/query `feed_post_hypes` for current user when loading feed.
3. **ph:// in createFeedPost** — Add ph:// to isLocal; upload before insert.
4. **Validation** — Reject blob/localhost/ph before DB write.
5. ** feed_comments policies** — Add UPDATE/DELETE for own comments if edit/delete is desired.
6. ** notifications table** — Create when in-app notifications are implemented.
7. **Pagination** — Add cursor-based pagination to getFeedPostsForHome.
8. **Friends-first feed** — Optional; implement if product requires it.
