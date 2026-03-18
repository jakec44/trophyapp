# Moderator access

Moderators can:

- Use **dev controls in Settings** (same section as devs; label shows "Moderator & Dev Debug").
- **Delete any feed post** on the home page (trash icon on each post).
- **Delete any tournament entry** on a tournament’s leaderboard (trash icon on each entry).

## How to delete as moderator

**Feed posts:** Home tab → scroll to the feed → each post has a trash icon (top-right, next to the time). Tap → confirm → removed.

**Tournament entries:** Compete tab → open a tournament → leaderboard. Each entry (1st, 2nd, 3rd, and MORE ENTRIES) has a trash icon. Tap → confirm → removed.

## How to make a user a moderator
1. In Supabase **Table Editor → `profiles`**, find the user (e.g. filter by `username` or `name`; see [FINDING_USERS_IN_SUPABASE.md](./FINDING_USERS_IN_SUPABASE.md)).
2. Edit that row and set **`is_moderator`** = `true`.
3. Save. The user may need to refresh the app or sign out and back in to see moderator options.

## Database

- Column: `profiles.is_moderator` (boolean, default `false`).
- RLS: `feed_posts` and `tournament_entries` allow **DELETE** when the current user is the row owner **or** has `profiles.is_moderator = true`.
