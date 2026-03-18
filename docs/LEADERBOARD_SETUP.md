# Angler Rating Leaderboard — Setup

If the leaderboard shows "No anglers yet" or you see **Could not find the function get_angler_leaderboard** in the app, do one of the following.

---

## Option A: Apply SQL in Supabase (recommended)

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file **`docs/APPLY_ANGLER_RATING_IN_SUPABASE.sql`** in your project, select all (Ctrl+A), copy.
4. Paste into the SQL Editor and click **Run**.
5. Wait for "Success". Then reload your app.  
   If the app still errors, in Dashboard go to **Settings** → **API** and note the Project URL; sometimes the schema cache updates after a short delay.

---

## Option B: Push migrations from PowerShell

1. **Open PowerShell in your project folder**
   - In **Cursor**: Terminal → New Terminal (or `` Ctrl+` ``). If the prompt shows `c:\Users\itsja\trophyapp`, you're already there.
   - Or in **File Explorer**: go to `c:\Users\itsja\trophyapp`, click the address bar, type `powershell`, press Enter.

2. **Run the push**
   ```powershell
   cd c:\Users\itsja\trophyapp
   npx supabase db push
   ```

3. **If you see "Do you want to push these migrations?"**
   - Type **Y** and press **Enter**.

4. **If it says migrations are "before the last on remote"**
   ```powershell
   npx supabase db push --include-all
   ```
   Then type **Y** and Enter when prompted.

5. **If it says "not logged in"**
   ```powershell
   npx supabase login
   ```
   Complete the login, then run `npx supabase db push` again.

---

After the function exists in Supabase, the app will call it correctly. The client will try both parameter orders so either migration style works.
