# Persistence + Global Visibility — Audit & Fixes

## A) Audit Table

| Feature | Current source (before fix) | Fix required | Status |
|--------|-----------------------------|--------------|--------|
| **Comments on feed posts** | `FeedContext.handleAddComment` only updated local state; never called Supabase | Wire to `add_feed_comment` RPC; fetch comments via `getFeedComments`; load when expanding | ✅ Done |
| **Likes (hype) on feed posts** | `FeedContext.handlePostHype` only updated local state | Wire to `hype_feed_post` RPC; fetch `isHyped` via `getHypedPostIdsForUser` on feed load | ✅ Done |
| **Share count** | No DB update on share; `handleShare` only navigated to friends | Call `increment_feed_share` RPC on share; show `share_count` from DB | ✅ Done |
| **Feed post list** | `getFeedPostsForHome` (Supabase) | Include `share_count`; merge `isHyped` from `feed_post_hypes` | ✅ Done |
| **Tournament votes** | `vote_on_tournament_entry` RPC in `tournamentDb.ts` | Already Supabase; no change | ✅ Already correct |
| **Friends** | `FriendsContext` uses `getFriendsWithProfiles`, `getPendingFriendRequests`, accept/decline/remove in `supabase.ts` | Already Supabase; no change | ✅ Already correct |
| **Search (users)** | `app/search.tsx` → `fetchProfiles(q)` from Supabase `profiles` | No change | ✅ Already Supabase |
| **Search (fish/species)** | `app/search.tsx` → `fetchSpecies(q)` from Supabase `catches` | No change | ✅ Already Supabase |
| **AsyncStorage** | Session (supabase.ts), story views, recents (search), logbook prefs, gamification XP, etc. | Only session + recents + prefs are appropriate for local; **comments/likes/hype** were never in AsyncStorage (they were in-memory only). No change to AsyncStorage for feed. | N/A |
| **Mock data** | `utils/feedMockData.ts` (RAW_CATCHES, MOCK_COMMENTS), `utils/mockData.ts` (mockUserProfile, mockFriends), used as fallbacks in some screens | Feed now uses Supabase only for feed posts; mock used for unauthenticated or dev fallbacks. No feed data from mock. | ✅ Feed fully Supabase |
| **Comment like (per-comment)** | `CommentSheet` / `FeedPostCard` comment row: local `liked` state | DB has `feed_comments.likes` but no toggle API. Left as display-only for now. | Optional later |

---

## B) Data Model (Supabase) — Confirmed

- **feed_posts**: id, user_id, photo_path, photo_url, species, weight_lb, length_in, caption, location, catch_id, hype_count, comment_count, **share_count** (from `20260229400000_feed_interactions.sql`), created_at. Public read; insert/update/delete own.
- **feed_post_hypes**: (post_id, user_id) PK; created_at. Prevents double-like. RLS: read all; insert/delete own.
- **feed_comments**: id, post_id, user_id, parent_comment_id, text, likes, created_at. RLS: read all; insert own; **DELETE own** added in `20260304100000_feed_comments_delete_rls.sql`.
- **Share count**: Column on feed_posts; incremented only via RPC `increment_feed_share(p_post_id)` (SECURITY DEFINER).
- **tournament_entries** / **tournament_entry_votes**: Already exist; votes via RPC `vote_on_tournament_entry`; UNIQUE(entry_id, user_id).
- **friendships**: user_id_1, user_id_2, status, requested_by. Queries: `getFriendsWithProfiles`, `getPendingFriendRequests`; send request creates row; accept/decline/remove update/delete.

No new tables were required; only RLS policy added for feed_comments DELETE.

---

## C) RLS Summary

- **feed_posts**: SELECT all; INSERT/UPDATE/DELETE where auth.uid() = user_id.
- **feed_post_hypes**: SELECT all; INSERT/DELETE where auth.uid() = user_id (no direct UPDATE).
- **feed_comments**: SELECT all; INSERT where auth.uid() = user_id; DELETE where auth.uid() = user_id (new policy).
- **Shares**: Client cannot UPDATE feed_posts.share_count; only `increment_feed_share` RPC.
- **Tournament votes**: RPC enforces auth.uid(); unique (entry_id, user_id).
- **Friends**: Requester/addressee can read; only requester can create pending; addressee can accept/decline; both can unfriend (delete accepted).

---

## D) Client Changes (Summary)

1. **Comments**
   - `FeedContext.handleAddComment`: calls `addFeedComment(postId, text, parentId)` then `loadComments(postId)`.
   - `loadComments(postId)`: fetches `getFeedComments(postId)` and merges into feed state.
   - `FeedPostCard`: when expanding comments, if comments empty, calls `loadComments(post.id)`.

2. **Likes (hype)**
   - `FeedContext.handlePostHype`: calls `hypeFeedPost(postId, hyped)` and updates state from result.
   - `refreshFeed`: loads `getHypedPostIdsForUser(user.id)` and passes `isHypedByMe` into `rowToFeedPost`.

3. **Share count**
   - On share button: `handleShare(post.id)` → `incrementFeedShare(postId)` and update local state with returned shareCount.
   - `FeedPostCard` shows share count when > 0; `rowToFeedPost` includes `shareCount` from row.

4. **Tournament votes**
   - Already use `voteOnTournamentEntry` (Supabase RPC). No change.

5. **Friends**
   - Already use Supabase for list, requests, accept, decline, remove. No change.

6. **Search**
   - Already uses Supabase: `fetchProfiles` (profiles), `fetchSpecies` (catches). No RAW_CATCHES or mock in search.

---

## E) Verification Checklist

- [ ] **Comment**: Create comment on Catch A with Account 1 → switch to Account 2 → refresh feed → open post → expand comments → Account 2 sees the comment.
- [ ] **Like**: Like Catch A with Account 2 → Account 1 sees like count update (refresh or realtime).
- [ ] **Share**: Share Catch A (tap share) → share count increments for everyone (refresh).
- [ ] **Vote**: Vote on a tournament entry with Account 2 → Account 1 sees new vote count (refresh).
- [ ] **Friends**: Friend request from A to B; B accepts; both see each other in friends list.
- [ ] **Search**: From Account 2, search for a user (Account 1’s username) and for a species; results come from Supabase (profiles + catches).

---

## Files Changed

| Path | Change |
|------|--------|
| `supabase/migrations/20260304100000_feed_comments_delete_rls.sql` | **New**: RLS policy DELETE for own comment on feed_comments. |
| `src/lib/supabase.ts` | FeedPostRow + share_count; getHypedPostIdsForUser, hypeFeedPost, addFeedComment, getFeedComments, incrementFeedShare. |
| `src/context/FeedContext.tsx` | refreshFeed with hyped set; handlePostHype → hypeFeedPost; handleAddComment → addFeedComment + loadComments; loadComments; handleShare → incrementFeedShare; rowToFeedPost(isHypedByMe, shareCount). |
| `utils/feedMockData.ts` | FeedPost.shareCount optional. |
| `src/components/home/FeedPostCard.tsx` | onShare, loadComments props; expand triggers loadComments when comments empty; share button calls onShare and shows shareCount; sync state from post. |
| `app/(tabs)/index.tsx` | Pass handleShare and loadComments to FeedPostCard. |
| `src/hooks/useUserFeedPosts.ts` | rowToFeedPost includes shareCount from row. |

---

## How to Test

1. **Apply migration**: Run the new migration only if your DB is already up to date with earlier migrations:
   - `supabase db push` (if you use linked remote and no pending older migrations), or
   - In Supabase SQL editor, run the contents of `supabase/migrations/20260304100000_feed_comments_delete_rls.sql` (adds DELETE policy for own comment).
   - If `db push` fails on an older migration (e.g. tournaments_seed constraint), apply only `20260304100000_feed_comments_delete_rls.sql` manually.
2. **Two devices/emulators (or two accounts)**:
   - Account 1: post a feed post (or use existing).
   - Account 2: open feed, like the post → Account 1 refreshes and should see hype count increase.
   - Account 2: add a comment → Account 1 refreshes, opens post, expands comments → sees comment.
   - Account 2: tap Share → share count increments; Account 1 sees it after refresh.
3. **Tournament**: Account 2 votes on Account 1’s entry; Account 1 sees updated vote count.
4. **Friends**: Send request A→B, accept on B; both lists show each other.
5. **Search**: Search username and species; results from DB only.

---

## EAS Rebuild

**No.** Changes are JS/TS and one new migration. No native code or env changes that require a new EAS build. Restart the dev client / Metro if needed.
