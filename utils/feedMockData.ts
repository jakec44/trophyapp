/**
 * Smart catch feed - Facebook/Instagram early retention algorithm
 * Every catch logged appears in feed. Public = all, Private = friends only.
 *
 * Algorithm order:
 * 1. FRIENDS FIRST — people user follows, most recent
 * 2. LOCAL NEXT — same city/state, "📍 Near you"
 * 3. NEARBY STATES — neighboring states, "📍 Florida"
 * 4. GLOBAL — fills the rest
 */

export type FeedSource = 'friend' | 'local' | 'nearby_state' | 'global';

export interface FeedComment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
  likes: number;
  parentId?: string;
  replyTo?: string;
  /** Parent comment id when this is a reply */
  parentCommentId?: string;
  /** User id of the comment being replied to */
  replyToUserId?: string;
  /** Username of the comment being replied to (for display) */
  replyToUsername?: string;
  proVerified?: boolean;
}

export interface FeedPost {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  postedAt: string;
  /** String URI or local require() asset (number) */
  photoUrl: string | number;
  /** Additional media URIs for multi-image posts (index 0 = primary) */
  mediaUrls?: string[];
  /** User-written caption — may include #hashtags */
  caption?: string;
  species: string;
  weight: number;
  length?: number;
  location: string;
  locationLabel: string; // "Near you" | "Florida" | etc.
  feedSource: FeedSource;
  hypeCount: number;
  commentCount: number;
  shareCount?: number;
  isHyped: boolean;
  tournamentRank?: number; // e.g. 3 for "This puts them at #3 this week"
  comments: FeedComment[];
  /** Achievement strip fields */
  isLiveCatch?: boolean;
  tournamentName?: string;
  tournamentId?: string;
  previousRank?: number;
  currentRank?: number;
  xpGained?: number;
  proVerified?: boolean;
  /** Author level (from total_xp) */
  authorLevel?: number;
  /** Author angler rating */
  authorAnglerRating?: number;
  /** Pinned badges for the post author (from user_profile_display_items) */
  authorDisplayItems?: Array<{
    type: string;
    id: string;
    badgeKey?: string;
    label: string;
    icon?: string;
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';
    trophyId?: string;
    tournamentName?: string;
    place?: 1 | 2 | 3;
    imageUrl?: string;
  }>;
}

export interface StoryItem {
  userId: string;
  username: string;
  avatar: string;
  catchPhotoUrl: string;
  species: string;
  weight: number;
  postedAt: string;
  watched?: boolean;
  isNearby?: boolean;
}

const PICSUM = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

// Real fishing photos uploaded by the user
const FEED_PHOTOS = {
  homeSeed: require('../assets/feed/home-seed.png') as number, // first image on home feed
  tarponBaby: require('../assets/feed/tarpon-baby.png') as number,
  snookHold: require('../assets/feed/snook-hold.png') as number,
  tarponGiant: require('../assets/feed/tarpon-giant.png') as number,
  bassNight: require('../assets/feed/bass-night.png') as number,
  snakehead: require('../assets/feed/snakehead.png') as number,
};

/** Sample mock comments for feed posts */
const MOCK_COMMENTS: Record<string, FeedComment[]> = {
  'feed-1': [
    {
      id: 'c1-1',
      userId: 'user-2',
      username: 'CoastalFlyCo',
      avatar: 'https://picsum.photos/seed/cfc/80/80',
      text: 'That thing is an absolute unit 🔥 what rod?',
      createdAt: new Date(Date.now() - 28 * 60000).toISOString(),
      likes: 14,
    },
    {
      id: 'c1-2',
      userId: 'user-4',
      username: 'GatorBaitMike',
      avatar: 'https://picsum.photos/seed/gbm/80/80',
      text: 'Night bite been slapping at Toho lately 🎣',
      createdAt: new Date(Date.now() - 22 * 60000).toISOString(),
      likes: 7,
    },
    {
      id: 'c1-3',
      userId: 'user-5',
      username: 'KeysTarponKing',
      avatar: 'https://picsum.photos/seed/ktk/80/80',
      text: 'New PB?? 🤯',
      createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
      likes: 3,
    },
    {
      id: 'c1-4',
      userId: 'user-1',
      username: 'BassMaster92',
      avatar: 'https://picsum.photos/seed/bm92/80/80',
      text: 'Big Bite Baits 8" dragon worm, green pumpkin',
      createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
      likes: 2,
      parentCommentId: 'c1-1',
      replyToUserId: 'user-2',
      replyToUsername: 'CoastalFlyCo',
    },
  ],
  'feed-2': [
    {
      id: 'c2-1',
      userId: 'user-1',
      username: 'BassMaster92',
      avatar: 'https://picsum.photos/seed/bm92/80/80',
      text: 'Baby tarpon on fly is so sick 🙌',
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
      likes: 8,
    },
    {
      id: 'c2-2',
      userId: 'user-5',
      username: 'KeysTarponKing',
      avatar: 'https://picsum.photos/seed/ktk/80/80',
      text: 'What weight setup? Looks like an 8wt?',
      createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
      likes: 3,
    },
    {
      id: 'c2-3',
      userId: 'user-2',
      username: 'CoastalFlyCo',
      avatar: 'https://picsum.photos/seed/cfc/80/80',
      text: 'Wadefish 9ft 8wt, love that rod for silver kings',
      createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
      likes: 5,
      parentCommentId: 'c2-2',
      replyToUserId: 'user-5',
      replyToUsername: 'KeysTarponKing',
    },
  ],
  'feed-3': [
    {
      id: 'c3-1',
      userId: 'user-1',
      username: 'BassMaster92',
      avatar: 'https://picsum.photos/seed/bm92/80/80',
      text: 'That snook is a SLED 🚀',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      likes: 22,
    },
    {
      id: 'c3-2',
      userId: 'user-6',
      username: 'SnakeheadSlayer',
      avatar: 'https://picsum.photos/seed/ssh/80/80',
      text: 'Naples beach been on fire this week',
      createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      likes: 9,
    },
  ],
  'feed-4': [
    {
      id: 'c4-1',
      userId: 'user-1',
      username: 'BassMaster92',
      avatar: 'https://picsum.photos/seed/bm92/80/80',
      text: 'That is a HORSE 😤 biggest tarpon I\'ve ever seen on this app',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      likes: 87,
    },
    {
      id: 'c4-2',
      userId: 'user-4',
      username: 'GatorBaitMike',
      avatar: 'https://picsum.photos/seed/gbm/80/80',
      text: 'Safe release on a fish that size — respect 🤜',
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      likes: 41,
    },
  ],
  'feed-5': [
    {
      id: 'c5-1',
      userId: 'user-4',
      username: 'GatorBaitMike',
      avatar: 'https://picsum.photos/seed/gbm/80/80',
      text: 'Snakehead in FL?? Invasive but that thing is gnarly lol',
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      likes: 18,
    },
    {
      id: 'c5-2',
      userId: 'user-6',
      username: 'SnakeheadSlayer',
      avatar: 'https://picsum.photos/seed/ssh/80/80',
      text: 'Yeah Coral Springs canal, they\'re everywhere now 😂',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      likes: 11,
      parentCommentId: 'c5-1',
      replyToUserId: 'user-4',
      replyToUsername: 'GatorBaitMike',
    },
  ],
};

/** Current user's location (mock) */
const CURRENT_USER_STATE = 'Florida';
const CURRENT_USER_CITY = 'Orlando';

/** User IDs the current user follows */
const FOLLOWING_IDS = new Set(['user-1', 'user-2']);

/** Raw catch posts before algorithm sort */
export const RAW_CATCHES: Omit<FeedPost, 'locationLabel' | 'feedSource'>[] = [
  // --- FRIENDS (2) - most recent first ---
  {
    id: 'feed-1',
    userId: 'user-1',
    username: 'BassMaster92',
    avatar: 'https://picsum.photos/seed/bm92/80/80',
    postedAt: new Date(Date.now() - 35 * 60000).toISOString(),
    photoUrl: FEED_PHOTOS.homeSeed,  // user's night snook/fish catch — first on home
    species: 'Largemouth Bass',
    weight: 11.2,
    length: 26,
    location: 'Lake Tohopekaliga, FL',
    hypeCount: 342,
    commentCount: 38,
    isHyped: false,
    tournamentRank: 1,
    comments: [],
    isLiveCatch: true,
    tournamentName: 'Bass Weekly',
    tournamentId: 'tournament-bass',
    previousRank: 3,
    currentRank: 1,
    xpGained: 250,
  },
  {
    id: 'feed-2',
    userId: 'user-2',
    username: 'CoastalFlyCo',
    avatar: 'https://picsum.photos/seed/cfc/80/80',
    postedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    photoUrl: FEED_PHOTOS.tarponBaby,  // baby tarpon on fly rod
    species: 'Tarpon',
    weight: 4.1,
    length: 28,
    location: 'Everglades, FL',
    hypeCount: 217,
    commentCount: 24,
    isHyped: true,
    comments: [],
    tournamentName: 'Tarpon Fly Classic',
    tournamentId: 'tournament-tarpon',
    currentRank: 2,
    xpGained: 120,
  },
  // --- LOCAL (3) - same state, "Near you" ---
  {
    id: 'feed-3',
    userId: 'user-4',
    username: 'GatorBaitMike',
    avatar: 'https://picsum.photos/seed/gbm/80/80',
    postedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    photoUrl: FEED_PHOTOS.snookHold,  // snook held in surf
    species: 'Snook',
    weight: 14.6,
    length: 42,
    location: 'Naples Beach, FL',
    hypeCount: 589,
    commentCount: 61,
    isHyped: false,
    tournamentRank: 1,
    comments: [],
    isLiveCatch: true,
    tournamentName: 'Snook Classic 2026',
    tournamentId: 'tournament-snook',
    previousRank: 2,
    currentRank: 1,
    xpGained: 200,
  },
  {
    id: 'feed-4',
    userId: 'user-5',
    username: 'KeysTarponKing',
    avatar: 'https://picsum.photos/seed/ktk/80/80',
    postedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    photoUrl: FEED_PHOTOS.tarponGiant,  // giant tarpon being released
    species: 'Tarpon',
    weight: 142,
    length: 74,
    location: 'Florida Keys, FL',
    hypeCount: 1847,
    commentCount: 203,
    isHyped: false,
    tournamentRank: 1,
    comments: [],
    isLiveCatch: true,
    tournamentName: 'Tarpon Fly Classic',
    tournamentId: 'tournament-tarpon',
    previousRank: 2,
    currentRank: 1,
    xpGained: 500,
  },
  {
    id: 'feed-5',
    userId: 'user-6',
    username: 'SnakeheadSlayer',
    avatar: 'https://picsum.photos/seed/ssh/80/80',
    postedAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    photoUrl: FEED_PHOTOS.snakehead,  // snakehead being held
    species: 'Northern Snakehead',
    weight: 8.7,
    length: 31,
    location: 'Coral Springs, FL',
    hypeCount: 423,
    commentCount: 55,
    isHyped: false,
    comments: [],
    xpGained: 175,
  },
  // --- NEARBY STATES (3) ---
  {
    id: 'feed-6',
    userId: 'user-7',
    username: 'GeorgiaBassPro',
    avatar: 'https://picsum.photos/seed/gbp/80/80',
    postedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    photoUrl: PICSUM('bass3'),
    species: 'Largemouth Bass',
    weight: 9.1,
    length: 25,
    location: 'Lake Lanier, GA',
    hypeCount: 156,
    commentCount: 19,
    isHyped: false,
    tournamentRank: 3,
    comments: [],
  },
  {
    id: 'feed-7',
    userId: 'user-8',
    username: 'AlabamaAngler',
    avatar: 'https://picsum.photos/seed/aa/80/80',
    postedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    photoUrl: PICSUM('cat1'),
    species: 'Channel Catfish',
    weight: 14.2,
    length: 32,
    location: 'Lake Martin, AL',
    hypeCount: 223,
    commentCount: 28,
    isHyped: false,
    comments: [],
  },
  {
    id: 'feed-8',
    userId: 'user-9',
    username: 'CarolinaCrappie',
    avatar: 'https://picsum.photos/seed/cc/80/80',
    postedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    photoUrl: PICSUM('crappie1'),
    species: 'Black Crappie',
    weight: 2.8,
    length: 14,
    location: 'Lake Murray, SC',
    hypeCount: 87,
    commentCount: 9,
    isHyped: false,
    comments: [],
  },
];

/** Mock: user location (city, state) - would come from profile */
const USER_LOCATIONS: Record<string, { city?: string; state: string }> = {
  'user-1': { city: 'Kissimmee', state: 'Florida' },
  'user-2': { city: 'Fort Lauderdale', state: 'Florida' },
  'user-4': { city: 'Naples', state: 'Florida' },
  'user-5': { city: 'Marathon', state: 'Florida' },
  'user-6': { city: 'Coral Springs', state: 'Florida' },
  'user-7': { city: 'Buford', state: 'Georgia' },
  'user-8': { city: 'Alexander City', state: 'Alabama' },
  'user-9': { city: 'Columbia', state: 'South Carolina' },
};

const NEARBY_STATES = ['Georgia', 'Alabama', 'South Carolina'];

function getFeedSource(post: { userId: string }): FeedSource {
  if (FOLLOWING_IDS.has(post.userId)) return 'friend';
  const loc = USER_LOCATIONS[post.userId];
  if (!loc) return 'global';
  if (loc.state === CURRENT_USER_STATE) return 'local';
  if (NEARBY_STATES.includes(loc.state)) return 'nearby_state';
  return 'global';
}

function getLocationLabel(post: { userId: string }): string {
  const src = getFeedSource(post);
  if (src === 'local') return 'Near you';
  const loc = USER_LOCATIONS[post.userId];
  if (src === 'nearby_state' && loc) return loc.state;
  return '';
}

/**
 * Smart feed algorithm: Friends → Local → Nearby States → Global
 * Sorted by recency within each bucket
 */
export function getSmartFeedPosts(): FeedPost[] {
  const withMeta = RAW_CATCHES.map((p) => {
    const comments = MOCK_COMMENTS[p.id] ?? [];
    return {
      ...p,
      comments,
      commentCount: Math.max(p.commentCount ?? 0, comments.length),
      feedSource: getFeedSource(p),
      locationLabel: getLocationLabel(p),
    };
  });

  const friends = withMeta.filter((p) => p.feedSource === 'friend');
  const local = withMeta.filter((p) => p.feedSource === 'local');
  const nearby = withMeta.filter((p) => p.feedSource === 'nearby_state');
  const global = withMeta.filter((p) => p.feedSource === 'global');

  // Already sorted by postedAt descending in raw data
  return [...friends, ...local, ...nearby, ...global];
}

export const mockFeedPosts = getSmartFeedPosts();

export const mockStories: StoryItem[] = [
  { userId: 'user-1', username: 'BassMaster92', avatar: 'https://picsum.photos/seed/bm92/80/80', catchPhotoUrl: PICSUM('bassnight'), species: 'Largemouth Bass', weight: 11.2, postedAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { userId: 'user-2', username: 'CoastalFlyCo', avatar: 'https://picsum.photos/seed/cfc/80/80', catchPhotoUrl: PICSUM('tarponfly'), species: 'Tarpon', weight: 4.1, postedAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { userId: 'user-4', username: 'GatorBaitMike', avatar: 'https://picsum.photos/seed/gbm/80/80', catchPhotoUrl: PICSUM('snooksurf'), species: 'Snook', weight: 14.6, postedAt: new Date(Date.now() - 8 * 3600000).toISOString() },
  { userId: 'user-5', username: 'KeysTarponKing', avatar: 'https://picsum.photos/seed/ktk/80/80', catchPhotoUrl: PICSUM('tarponbig'), species: 'Tarpon', weight: 142, postedAt: new Date(Date.now() - 12 * 3600000).toISOString(), watched: true },
  { userId: 'user-6', username: 'SnakeheadSlayer', avatar: 'https://picsum.photos/seed/ssh/80/80', catchPhotoUrl: PICSUM('snakehead'), species: 'Northern Snakehead', weight: 8.7, postedAt: new Date(Date.now() - 24 * 3600000).toISOString() },
];
