# Fish Imagery – Setup & AI Tools

Background removal has been removed per product spec. This document describes the simplified imagery flow.

## User Flow

1. **Add Photo** – **Take Photo** or **Choose from Gallery**.
2. **Your Catch** – Photo confirmation screen with AI species detection (if available). User can edit species/weight/length, then **Continue to Log**.
3. **Log** – Log catch form with pre-filled details.

## Display Logic

| Location              | Image Shown      |
|-----------------------|------------------|
| Logbook grid          | `photo`          |
| Leaderboard           | `fishImageUrl` or `photo` |

## AI Services (Optional)

- **Enhance** – fal.ai Image-to-Image (EXPO_PUBLIC_FAL_KEY)
- **Fish detection** – Species, weight, length from image (local or cloud)

## Schema (Supabase)

- `catches.photo_url` – Photo URL
- `catches.photo_thumb_url` – Thumbnail (optional)
