# Edge Functions Setup

## analyze-fish

AI fish identification using fal.ai LLaVA vision model.

### Deploy

```bash
supabase functions deploy analyze-fish
```

### Secrets

Set `FAL_KEY` (your fal.ai API key):

```bash
supabase secrets set FAL_KEY=your-fal-api-key
```

### Usage

The client calls the function via `supabase.functions.invoke('analyze-fish', { body: { imageUrl } })`.

Input: `{ imageUrl: string }` or `{ storagePath: string, bucket?: string }`
Output: `{ species, estimated_length_in, estimated_weight_lb, confidence, notes }`
