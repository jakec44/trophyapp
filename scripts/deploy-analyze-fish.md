# Deploy Fish Analyzer (One-Time Setup)

Follow these steps to deploy the AI fish analyzer so it works in your app.

---

## 1. Get an OpenAI API Key (Required for AI)

The analyzer uses OpenAI's GPT-4o vision model.

1. Go to **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)**
2. Sign up or log in
3. Create an API key
4. Copy it — you'll need it in step 5

---

## 2. Install & Log In to Supabase CLI

Open a terminal in the project folder and run:

```bash
npx supabase login
```

A browser window will open. Sign in with your Supabase account.

---

## 3. Link Your Project

Your project ID is in your `.env`: `iutwkyiiendlqxytdzih`

```bash
npx supabase link --project-ref iutwkyiiendlqxytdzih
```

When prompted for the database password, use the password you set when creating the Supabase project (or reset it in the Supabase dashboard under Settings → Database).

---

## 4. Deploy the Edge Functions

```bash
npx supabase functions deploy analyze-fish
npx supabase functions deploy upload-catch-photo
```

---

## 5. Set the OPENAI_API_KEY Secret

Replace `YOUR_OPENAI_API_KEY` with your actual OpenAI API key from step 1:

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY --project-ref iutwkyiiendlqxytdzih
```

**Alternative (no terminal):** Supabase Dashboard → Project → Edge Functions → `analyze-fish` → Manage secrets → Add `OPENAI_API_KEY`.

---

## 6. Create Storage Bucket (required for photo upload)

**You must create the `catches` bucket or you'll get "Bucket not found":**

1. Supabase Dashboard → **Storage**
2. Click **New bucket**
3. Name: `catches`
4. Toggle **Public bucket** ON
5. Click **Create bucket**

---

## 7. Done

Your app should now auto-analyze fish photos when you log a catch. If something fails:

- Check the Supabase Dashboard → Edge Functions → `analyze-fish` → Logs
- Ensure `OPENAI_API_KEY` is set
- Ensure the `catches` bucket exists and is public
