# Trophy Room - Build-Out Roadmap

## Vision
Transform TrophyApp from basic tabs into **Trophy Room**: a full-featured social fishing app where users mount their best catches on interactive digital walls.

**Tagline**: "Mount your best catches. Flex your wall."

## MVP Phases

### Phase 1: Core Catch Management (Current → Weeks 1-2)
**Goal**: Enable users to upload, identify, and organize fish catches

- [x] Home screen with "Take a Picture!" CTA
- [x] Basic tabs layout (5 screens)
- [x] Mock data system
- [ ] **Supabase Integration**: Auth + Database setup
  - [ ] Supabase project creation + config
  - [ ] Auth: Email/password + Apple Sign In
  - [ ] PostgreSQL schema migration
  - [ ] RLS policies
  
- [ ] **Image Upload & Optimization**
  - [ ] Image picker (camera + gallery)
  - [ ] Image optimizer: 10MB cap → 1600px WebP + 300px thumb
  - [ ] Supabase Storage bucket setup: `trophy-images`
  
- [ ] **AI Fish Identification**
  - [ ] Supabase Edge Functions: `identify-fish`, `remove-background`, `detect-fish-direction`
  - [ ] Background removal → transparent PNG
  - [ ] Species detection → confidence %
  
- [ ] **Logbook Screen** (/logbook)
  - [ ] 3-column grid of catches
  - [ ] Thumbnail optimization
  - [ ] Detail overlay: full image + edit/delete
  - [ ] Upload limit enforcement (10 free, 50 pro/month)

### Phase 2: Social & Leaderboard (Weeks 3-4)
**Goal**: Enable competition and social discovery

- [ ] **Leaderboard** (/leaderboard)
  - [ ] 7 competitions: Most Fish, Biggest Fish, Biggest [species] × 5
  - [ ] Local (free) vs Global (Pro) toggle
  - [ ] Weight entry form + validation
  - [ ] Anti-cheating warnings
  - [ ] Community flagging system
  
- [ ] **Friends System** (/friends)
  - [ ] Invite code generation (6 char)
  - [ ] Redeem code → bidirectional friendship
  - [ ] Friends list with counts
  
- [ ] **Profile** (/profile/:userId)
  - [ ] Avatar + banner (editable on own)
  - [ ] Display name, city, state, bio
  - [ ] Stats: total fish, weekly rank
  - [ ] Weekly badges display (🥇🥈🥉)

### Phase 3: Trophy Rooms (Weeks 5-6)
**Goal**: Enable interactive digital trophy display

**Mobile Strategy**: 2D canvas-based walls initially (full 3D via web)

- [ ] **Trophy Room** (/room, /room2, /room3)
  - [ ] 2D wall canvas with mounted fish slots
  - [ ] Tap to add fish (opens logbook picker)
  - [ ] Drag to rearrange, long-press to remove
  - [ ] Custom room naming
  - [ ] ProGate overlay (Pro-only feature)
  
- [ ] **Mount Interactions**
  - [ ] Display scale slider
  - [ ] Display offset X/Y (fine positioning)
  - [ ] Label/rename mounted fish
  - [ ] Weekly mount limit (5/week)

### Phase 4: Messaging & Direct Social (Weeks 7-8)
**Goal**: Enable real-time chat and friend interaction

- [ ] **Direct Messaging** (/messages)
  - [ ] Conversations list (friends grouped)
  - [ ] Conversation view (real-time via Supabase Realtime)
  - [ ] Message read receipts
  - [ ] Requires auth
  
- [ ] **Live Activity**
  - [ ] LiveNowBar: scrolling ticker of active users
  - [ ] Friend activity subscriptions

### Phase 5: Authentication & Monetization (Weeks 9-10)
**Goal**: Launch user accounts and Pro tier

- [ ] **Auth System** (/auth)
  - [ ] Email + password sign up/in
  - [ ] Apple Sign In (Supabase OAuth)
  - [ ] Anonymous anon user support
  - [ ] Data migration on sign-in
  
- [ ] **Subscriptions**
  - [ ] Free tier: 10 lifetime uploads
  - [ ] Pro tier: 50 uploads/month ($9/month or $34/year)
  - [ ] Apple IAP via RevenueCat
  - [ ] Verified badge ✅ for Pro users
  
- [ ] **Paywall** (/paywall)
  - [ ] Feature list + pricing toggle
  - [ ] CTA button → Apple IAP
  - [ ] "Restore Purchase" link

- [ ] **Settings** (/settings)
  - [ ] Display name + city/state
  - [ ] Public toggle (leaderboard opt-in)
  - [ ] Room names
  - [ ] Sign out / delete account

### Phase 6: Polish & Launch (Weeks 11-12)
- [ ] App Store submission (iOS primary)
- [ ] Error handling & edge cases
- [ ] Performance optimization
- [ ] Analytics integration
- [ ] Beta testing with friends

## Future Roadmap (Post-MVP)
- 3D Trophy Rooms (React Three Fiber) on web version
- Push notifications (friend activity, rank changes)
- Weekly badge auto-assignment cron
- Video uploads for trophy walls
- Fishing location tagging + map view
- Share Trophy Room as image/video
- Species achievements & milestones
- Social feed ("wall") showing friend catches

## Technical Dependencies (To Add)
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@supabase/auth-helpers-react-native": "^x.x",
    "@react-native-async-storage/async-storage": "^1.x",
    "react-native-image-picker": "^7.x",
    "react-native-image-crop-picker": "^0.x",
    "expo-image": "~1.x",
    "expo-av": "~14.x",
    "expo-permissions": "~15.x",
    "react-query": "^3.x",
    "@tanstack/react-query": "^4.x",
    "react-native-toast-notifications": "^3.x",
    "zustand": "^4.x"
  }
}
```

## Database Schema Setup
See [schema.sql](./schema.sql) for full PostgreSQL migration.

Key tables:
- `catches` - user fish records
- `profiles` - user data + subscription
- `mount_slots` - trophy room wall placements
- `room_props` - decorative objects (future)
- `friendships` - bidirectional friend relationships
- `messages` - direct messages
- `leaderboard_entries` - pre-computed rankings
- `weekly_badges` - competition winners

## Deployment Strategy
1. **Expo Go**: Dev/testing in Expo Go app
2. **EAS Build**: Build via Expo Application Services
3. **App Store**: Submit iOS app
4. **Google Play**: Submit Android app (secondary)
5. **Web**: Optional web version via Expo web (or separate React app with 3D)

## Success Metrics
- 100+ active daily users (Week 4)
- 50+ Pro subscribers (Week 6)
- < 2s app load time
- < 500ms image processing time
- 99.9% uptime
