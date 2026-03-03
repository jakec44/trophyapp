# Biggest Fish tournament seed images

The **Biggest Fish** tournament is seeded with three large Tarpon entries (84", 78", 72") in `src/api/tournaments.ts`.

To use your own photos as those top three seeds:

1. Host your three images (e.g. upload to your Supabase storage or a CDN).
2. In `src/api/tournaments.ts`, replace `BIG_FISH_SEED_IMAGES` so the three URLs point to your images instead of `PICSUM('tarpon-seed1')` etc.

You can also add `tarpon1.png`, `tarpon2.png`, `tarpon3.png` here and reference them via a small image-loader module if you prefer local assets.
