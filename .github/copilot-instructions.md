# Copilot Instructions for Trophy Room

## Project Overview

**Trophy Room** is a React Native fishing social app where users mount their best catches on interactive digital walls and compete on leaderboards. Tagline: "Mount your best catches. Flex your wall."

**Target Audience**: Competitive fishermen aged 16-35  
**Platform**: Mobile-first (React Native + Expo), secondary web support  
**Design**: Dark premium interface (#0A0A0A bg, #C9A84C gold accents) — think ESPN × Instagram × hunting lodge

## Architecture

### Core Tech Stack
- **Framework**: React Native 0.81.5 + Expo ~54.0.33 + Expo Router ~6.0.23
- **Language**: TypeScript 5.9.2 (strict mode required)
- **Navigation**: Expo Router v6+ with file-based routing
- **State**: React hooks + TanStack Query (not yet integrated)
- **Styling**: React Native StyleSheet.create() + semantic color tokens
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Backend Services**: Supabase Edge Functions for AI (Gemini Vision, rembg)
- **Payments**: Apple IAP via RevenueCat
- **Deployment**: EAS Build → App Store (iOS primary), Google Play (Android)

### Directory Structure
```
trophyapp/
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root Stack layout
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── _layout.tsx           # Auth Stack
│   │   └── login.tsx             # Email/password + Apple Sign In
│   └── (tabs)/                   # Authenticated tab navigation
│       ├── _layout.tsx           # Tabs navigation (5 tabs)
│       ├── index.tsx             # Home (future: "Take a Picture!" CTA + recent activity)
│       ├── logbook.tsx           # 3-column grid of user catches
│       ├── leaderboard.tsx       # 7 competitions + rankings
│       ├── room.tsx              # Trophy room #1 (2D canvas wall)
│       ├── profile.tsx           # User profile + settings
│       ├── friends.tsx           # Friend list + invite codes
│       ├── messages.tsx          # Direct messaging
│       ├── paywall.tsx           # Pro subscription UI
│       ├── settings.tsx          # Account settings
│       └── room[roomId].tsx      # Dynamic room routes (room2, room3)
├── src/                          # Utility & component code
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client + auth helpers
│   │   ├── imageOptimizer.ts    # Image pipeline (resize, WebP, thumbs)
│   │   ├── aiClient.ts          # AI edge function calls
│   │   └── constants.ts         # App-wide constants
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth state hook
│   │   ├── useCatches.ts        # Fetch user catches
│   │   ├── useLeaderboard.ts    # Fetch leaderboard
│   │   └── useFriends.ts        # Fetch friends
│   ├── components/
│   │   ├── CatchCard.tsx        # Reusable catch card
│   │   ├── TabBarIcon.tsx       # Tab navigation icon
│   │   ├── ProGate.tsx          # Pro-only feature overlay
│   │   ├── TrophyRoom.tsx       # 2D canvas wall renderer
│   │   └── LeaderboardEntry.tsx # Leaderboard row
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   └── utils/
│       ├── colors.ts            # Color tokens
│       └── mockData.ts          # Development mock data
├── assets/                       # Images, icons, splash screens
├── BUILD_ROADMAP.md             # Phase breakdown & timeline
├── schema.sql                   # PostgreSQL migration
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config (strict mode enabled)
└── index.ts                     # Entry point (export App)
```

## Feature Roadmap

### Phase 1: Core Catch Management (Weeks 1-2)
**Goal**: Users can upload fish photos, identify species, organize catches

#### Screens
- **Home** (app/(tabs)/index.tsx) - CTA button "Take a Picture!"
- **Logbook** (app/(tabs)/logbook.tsx) - 3-column grid, thumbnail cache
- **Log Catch** (app/(tabs)/log.tsx) - Photo upload → AI identification → confirmation

#### Key Systems
- **Image Pipeline**: 10MB cap → resize 1600px → WebP 80% → store 300px thumb
- **AI Fish ID**: Supabase Edge Function + Gemini Vision (identify species, confidence %)
- **Background Removal**: Edge Function using rembg API → transparent PNG
- **Upload Limits**: Free tier 10 lifetime, Pro tier 50/month (enforced in src/lib/imageOptimizer.ts)

#### API Endpoints (Supabase)
- `POST /catches` - Create catch record
- `GET /catches?user_id=:id` - Fetch user catches
- `DELETE /catches/:id` - Delete catch
- Edge Functions: `identify-fish`, `remove-background`, `detect-fish-direction`

### Phase 2: Social & Leaderboard (Weeks 3-4)
**Goal**: Enable competition and friend discovery

#### Screens
- **Leaderboard** (app/(tabs)/leaderboard.tsx) - 7 competitions, local/global toggle
- **Friends** (app/(tabs)/friends.tsx) - List, generate/redeem invite codes
- **Friend Profile** (app/(tabs)/profile/:userId.tsx) - Public profile view

#### Competition System
7 leaderboard categories:
1. Most Fish (count)
2. Biggest Fish (any species)
3. Biggest Bass (species-specific)
4. Biggest Redfish
5. Biggest Tarpon
6. Biggest Snook
7. Biggest Black Drum

**Features**: 
- Weight entry (lb) + optional length (in)
- Local (free, city-based) vs Global (Pro)
- Community flagging (5 flags = removal)
- Anti-cheating warnings on suspicious entries
- Weekly badge assignment (top 3 finishers: 🥇🥈🥉)

#### Friend System
- **Invite Codes**: 6-char alphanumeric, 7-day expiry, one-time use
- **Friendship**: Bidirectional after redemption
- **Display**: Avatar, name, city, mutual friend count

### Phase 3: Trophy Rooms (Weeks 5-6)
**Goal**: Interactive digital display of mounted catches

#### Screens
- **Room 1, 2, 3** (app/(tabs)/room.tsx, room2.tsx, room3.tsx)

#### Mobile Implementation (2D Canvas-based)
- Background image: wooden wall texture
- Mount slots: 8-12 interactive areas
- Interactions:
  - Tap empty slot → Logbook picker → select catch → add to wall
  - Drag fish to rearrange
  - Long-press to remove
  - Label/rename mounted fish
- **Limits**: 5 mounts/week (enforced via generation_usage table)
- **Customization**: Room name input (stored in profiles table)
- **ProGate**: Full rooms restricted to Pro tier (show overlay with "Upgrade" CTA)

### Phase 4: Messaging & Real-time (Weeks 7-8)
**Goal**: Friend communication

#### Screens
- **Messages** (app/(tabs)/messages.tsx) - Conversation list
- **Conversation** (app/(tabs)/messages/:friendId.tsx) - Chat view

#### Features
- Text messaging only (initial MVP)
- Supabase Realtime subscriptions for live sync
- Read receipts (optional)
- Unread count badges on tab bar
- Requires authentication

### Phase 5: Auth & Monetization (Weeks 9-10)
**Goal**: User accounts and revenue generation

#### Auth System (Supabase)
- Email/password sign up/in
- Apple Sign In (OAuth)
- Sessions stored in AsyncStorage
- Data migration: anonymous catches → user account on sign-in
- src/hooks/useAuth.ts manages state

#### Subscriptions
- **Free Tier**: $0, 10 lifetime uploads, local leaderboards
- **Pro Tier**: $9/month or $34/year (RevenueCat integration)
  - 50 uploads/month
  - Global leaderboards
  - Full 3D trophy rooms
  - Friend messaging
  - ✅ Verified badge on profile

#### Paywall Screen (app/(tabs)/paywall.tsx)
- Feature comparison table
- Monthly/Annual pricing toggle
- Apple IAP purchase button
- "Restore Purchase" link
- Price localization

### Phase 6: Settings & Profiles (Weeks 10-11)
**Goal**: User customization

#### Settings (app/(tabs)/settings.tsx)
- Display name, city, state, bio
- Public toggle (opt-in to leaderboard)
- Room name customization
- Notification preferences
- Privacy settings
- Account deletion

#### Profile (app/(tabs)/profile.tsx)
- Avatar (editable)
- Banner image (editable)
- Stats: total fish, weekly rank, catch streak
- Weekly badges display
- Public/Private toggle
- Link to Friends screen

### Phase 7: Polish & Launch (Weeks 11-12)
- Error handling & edge cases
- Performance optimization
- Analytics (Segment, Amplitude)
- App Store submission (iOS)
- Beta testing
- Monitoring setup

## Database Schema

### Core Tables

#### `profiles`
```sql
id UUID PRIMARY KEY (references auth.users)
display_name TEXT
avatar_url TEXT
banner_url TEXT
city TEXT
state TEXT
bio TEXT
subscription_plan ENUM ('free', 'pro')
pro_verified BOOLEAN DEFAULT false
pro_expires_at TIMESTAMP
public BOOLEAN DEFAULT true
generation_usage_this_month INT DEFAULT 0
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### `catches`
```sql
id UUID PRIMARY KEY
user_id UUID (fk profiles)
species TEXT
weight_lb FLOAT
length_in FLOAT
location TEXT
notes TEXT
photo_url TEXT
photo_thumb_url TEXT (300px)
background_removed_url TEXT
identified_confidence FLOAT (0-1)
compass_direction TEXT (N, NE, E, etc)
taken_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP (soft delete)
```

#### `mount_slots`
```sql
id UUID PRIMARY KEY
user_id UUID (fk profiles)
room_number INT (1, 2, or 3)
slot_position INT (0-11)
catch_id UUID (fk catches, nullable)
label TEXT (custom name override)
position_x FLOAT (0-1, relative)
position_y FLOAT (0-1, relative)
scale FLOAT (default 1.0)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### `friendships`
```sql
id UUID PRIMARY KEY
user_id_1 UUID (fk profiles)
user_id_2 UUID (fk profiles)
status ENUM ('pending', 'accepted', 'blocked')
created_at TIMESTAMP
unique(user_id_1, user_id_2)
```

#### `friend_invites`
```sql
id UUID PRIMARY KEY
code TEXT UNIQUE (6 chars)
user_id UUID (fk profiles)
expires_at TIMESTAMP
redeemed_by_user_id UUID (nullable, fk profiles)
redeemed_at TIMESTAMP (nullable)
created_at TIMESTAMP
```

#### `messages`
```sql
id UUID PRIMARY KEY
conversation_id UUID
sender_id UUID (fk profiles)
recipient_id UUID (fk profiles)
body TEXT
read_at TIMESTAMP (nullable)
created_at TIMESTAMP
```

#### `leaderboard_entries`
```sql
id UUID PRIMARY KEY
competition_id INT (0-6, matches 7 competitions)
user_id UUID (fk profiles)
weight_lb FLOAT
length_in FLOAT
catch_id UUID (fk catches)
rank INT
location TEXT (for local leaderboards)
flagged_count INT DEFAULT 0
hidden BOOLEAN DEFAULT false
computed_at TIMESTAMP
```

#### `weekly_badges`
```sql
id UUID PRIMARY KEY
competition_id INT (0-6)
user_id UUID (fk profiles)
week_starting DATE
position INT (1=gold, 2=silver, 3=bronze)
badge_emoji TEXT ('🥇', '🥈', '🥉')
created_at TIMESTAMP
unique(competition_id, user_id, week_starting)
```

#### `generation_usage`
```sql
id UUID PRIMARY KEY
user_id UUID (fk profiles)
month DATE (first day of month)
ai_calls_count INT
uploads_count INT
created_at TIMESTAMP
updated_at TIMESTAMP
unique(user_id, month)
```

### RLS (Row Level Security) Policies

```sql
-- profiles: public read, own write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- catches: own read, own write, deleted soft-delete only
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own catches" ON catches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catches" ON catches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can soft-delete own catches" ON catches FOR UPDATE USING (auth.uid() = user_id);

-- messages: own read/write, bidirectional
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON messages FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages to friends" ON messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM friendships WHERE 
    ((user_id_1 = auth.uid() AND user_id_2 = recipient_id) OR
     (user_id_2 = auth.uid() AND user_id_1 = recipient_id)) AND
    status = 'accepted'
  ));
```

## Color System

All UI uses color tokens from `src/utils/colors.ts`:

```typescript
export const colors = {
  background: '#0A0A0A',    // Near-black background
  card: '#1A1A1A',          // Dark gray cards
  gold: '#C9A84C',          // Premium accent
  text: '#FFFFFF',          // White text
  subtext: '#888888',       // Gray secondary text
  border: '#2A2A2A',        // Dark borders
  success: '#4CAF50',       // Green
  warning: '#FF9800',       // Orange
  danger: '#F44336',        // Red
} as const;
```

## Component Patterns

### Screen Structure
```typescript
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/utils/colors';

export default function MyScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Content */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  text: { color: colors.text, fontSize: 16 },
});
```

### Common Components
- **CatchCard** - Display individual catch (photo, species, weight, date)
- **TabBarIcon** - Bottom tab icon with label and gold accent
- **LeaderboardEntry** - Ranked entry with avatar, name, weight
- **ProGate** - Overlay for Pro-only features (with Upgrade button)
- **TrophyRoom** - 2D canvas renderer for wall slots

## Development Patterns

### Hooks (Custom)
- `useAuth()` - Current user, sign in/out, sign up
- `useCatches()` - Fetch, cache, invalidate user catches (TanStack Query)
- `useLeaderboard()` - Fetch competition rankings
- `useFriends()` - Fetch friends list, pending invites
- `useMessages()` - Realtime message subscription

### Image Optimization
All uploads pass through `src/lib/imageOptimizer.ts`:

```typescript
const optimizer = new ImageOptimizer();
const result = await optimizer.optimize({
  uri: imagePickerResult.uri,
  maxSize: 10_000_000, // 10MB
  quality: 80,
});
// Returns: { optimized, thumbnail, originalSize, optimizedSize }
```

### Supabase Queries
```typescript
import { supabase } from '@/lib/supabase';

// Fetch catches
const { data, error } = await supabase
  .from('catches')
  .select('*')
  .eq('user_id', userId)
  .order('taken_at', { ascending: false });

// Real-time message subscription
const subscription = supabase
  .channel('messages')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
    // Handle message
  })
  .subscribe();
```

### TypeScript Patterns
- Strict mode required: no implicit `any`
- Interface every data structure (catches, profiles, etc.)
- Use `typeof` for type inference where possible
- Nullable fields: `field?: type` not `field: type | null`

## Deployment

### Local Development
```bash
npm start                 # Start Expo dev server
npm run ios              # Run iOS simulator
npm run android          # Run Android emulator
npm run web              # Run web version
```

### EAS Build (Managed Builds)
```bash
eas build --platform ios --auto-submit  # Build & submit to App Store
eas build --platform android            # Build Android APK/AAB
```

### Configuration (eas.json)
```json
{
  "build": {
    "production": {
      "ios": {
        "distribution": "app-store",
        "scheme": "trophyapp"
      },
      "android": {
        "distribution": "google-play",
        "buildType": "apk"
      }
    }
  }
}
```

## Important Notes
- **Mobile-First**: React Native primitives only, no web-specific React/web imports
- **Strict TypeScript**: All files must pass `npx tsc --noEmit`
- **Path Aliases**: Use `@/` prefix (e.g., `import { colors } from '@/utils/colors'`)
- **Assets**: Optimize all images before committing (use tinypng.com)
- **Offline Support**: Consider AsyncStorage caching for critical data
- **Error Messages**: Show user-friendly messages via Toasts (toast notifications library)
- **3D Rooms Future**: Reserved for web version using React Three Fiber; mobile stays 2D
- **Analytics**: Track key metrics (signups, uploads, purchases, leaderboard rank)
