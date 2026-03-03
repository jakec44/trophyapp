# Cutout API

Composites a segmentation mask onto the original image as the alpha channel, producing a full-color PNG with transparency.

## Setup

```bash
cd api
npm install
cp .env.example .env
# Edit .env if using Supabase for JSON mode
npm start
```

Runs on `http://localhost:3001` by default.

## Endpoint

**POST /cutout**

Body:
```json
{ "imageUrl": "https://...", "maskUrl": "https://..." }
```

- **imageUrl**, **maskUrl**: Public URLs to the original image and black/white mask
- Returns: `image/png` (RGBA cutout)
- If `Accept: application/json` and Supabase configured: returns `{ "cutoutUrl": "https://..." }`

## Env (optional)

| Var | Description |
|-----|-------------|
| `SUPABASE_URL` | For JSON mode cutoutUrl upload |
| `SUPABASE_SERVICE_ROLE_KEY` | For uploads |
| `SUPABASE_CUTOUT_BUCKET` | Bucket name (default: `cutouts`) |
| `PORT` | Server port (default: 3001) |

## Expo client

Add to `.env`:
```
EXPO_PUBLIC_CUTOUT_API_URL=http://localhost:3001
EXPO_PUBLIC_REPLICATE_API_TOKEN=your-token
```

For physical device, use your machine's LAN IP: `http://192.168.x.x:3001`
