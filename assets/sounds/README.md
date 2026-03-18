# Sound effects (optional)

Add short `.mp3` files here to enable sound effects in the app.

- **like.mp3** – double-tap like / hype (light tap)
- **send.mp3** – send message / submit (short whoosh or tap)
- **success.mp3** – catch logged, level up (short success chime)

Then in `src/lib/feedback.ts` you can wire them up, for example:

```ts
// At the top, after imports:
const SOUND_LIKE = require('@/assets/sounds/like.mp3'); // add when file exists

// In triggerLike():
playSound(SOUND_LIKE);
```

Keep files short (under ~0.5s) and small for quick playback.
