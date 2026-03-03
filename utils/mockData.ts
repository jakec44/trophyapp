export interface Catch {
  id: string;
  species: string;
  weight: number;
  length: number;
  location: string;
  date: string;
  photo: string;
  /** Original photo with full scene (person, background) - shown when user taps preview */
  photoOriginal?: string;
  /** Custom display name (e.g. "Bruce") */
  name?: string;
  speciesConfidence?: number;
  notes?: string;
  /** AI analysis: pending | done | failed */
  ai_status?: 'pending' | 'done' | 'failed';
}

export interface LeaderboardEntry {
  id?: string;
  rank: number;
  userId: string;
  username: string;
  species: string;
  weight: number;
  length?: number;
  location: string;
  avatar: string;
  /** Pro tier = blue check badge */
  proVerified?: boolean;
  /** Tournament badges: 🥇 🥈 🥉 */
  badges?: string[];
  /** Fish image URL for display */
  fishImageUrl?: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  participants: number;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export const mockCatches: Catch[] = [
  {
    id: '1',
    species: 'Sandbar Shark',
    name: 'Bruce',
    weight: 60,
    length: 60,
    location: 'Gulf Coast, FL',
    date: '2026-02-18',
    photo: 'https://via.placeholder.com/400x300/1A1A1A/C9A84C?text=Shark+60lb',
    photoOriginal: 'https://via.placeholder.com/400x300/87CEEB/C9A84C?text=Original+Photo',
    speciesConfidence: 95,
    notes: 'Great catch at the beach',
  },
  {
    id: '2',
    species: 'Largemouth Bass',
    weight: 8.5,
    length: 24,
    location: 'Lake Okeechobee, FL',
    date: '2026-02-15',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Bass+8.5lb',
    notes: 'Caught near the vegetation edge',
  },
  {
    id: '2b',
    species: 'Rainbow Trout',
    weight: 6.2,
    length: 20,
    location: 'Clear Water Lake, CO',
    date: '2026-02-10',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Trout+6.2lb',
    notes: 'Morning catch',
  },
  {
    id: '3',
    species: 'Striped Bass',
    weight: 7.8,
    length: 22,
    location: 'Chesapeake Bay, MD',
    date: '2026-02-08',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Striped+7.8lb',
  },
  {
    id: '4',
    species: 'Catfish',
    weight: 5.3,
    length: 18,
    location: 'Mississippi River, LA',
    date: '2026-02-05',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Catfish+5.3lb',
  },
  {
    id: '5',
    species: 'Walleye',
    weight: 4.1,
    length: 16,
    location: 'Lake Erie, OH',
    date: '2026-02-01',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Walleye+4.1lb',
  },
  {
    id: '6',
    species: 'Pike',
    weight: 9.2,
    length: 26,
    location: 'Northern Pike Lodge, MN',
    date: '2026-01-28',
    photo: 'https://via.placeholder.com/200x200/1A1A1A/C9A84C?text=Pike+9.2lb',
    notes: 'Best catch of the season!',
  },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: 'user-1',
    username: 'BassMaster92',
    species: 'Largemouth Bass',
    weight: 12.3,
    length: 26,
    location: 'Lake Okeechobee, FL',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=BM',
    proVerified: true,
    badges: ['🥇', '🥈'],
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Bass',
  },
  {
    rank: 2,
    userId: 'user-2',
    username: 'PikeHunter',
    species: 'Northern Pike',
    weight: 11.8,
    length: 34,
    location: 'Minnesota Lakes',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=PH',
    proVerified: false,
    badges: ['🥉'],
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Pike',
  },
  {
    rank: 3,
    userId: 'user-3',
    username: 'TroutWhisperer',
    species: 'Rainbow Trout',
    weight: 9.5,
    length: 28,
    location: 'Rocky Mountain Region',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=TW',
    proVerified: true,
    badges: ['🥇', '🥇'],
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Trout',
  },
  {
    rank: 4,
    userId: 'user-4',
    username: 'StripedKing',
    species: 'Striped Bass',
    weight: 8.7,
    length: 22,
    location: 'Chesapeake Bay, MD',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=SK',
    proVerified: false,
    badges: [],
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Striped',
  },
  {
    rank: 5,
    userId: 'user-5',
    username: 'WalleyeNinja',
    species: 'Walleye',
    weight: 7.2,
    length: 24,
    location: 'Great Lakes Region',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=WN',
    proVerified: true,
    badges: ['🥈'],
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Walleye',
  },
];

export const mockTournaments: Tournament[] = [
  {
    id: '1',
    name: 'Spring Bass Championship 2026',
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    location: 'Lake Okeechobee, FL',
    participants: 128,
    status: 'upcoming',
  },
  {
    id: '2',
    name: 'Walleye Warriors Cup',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    location: 'Lake Erie, OH',
    participants: 85,
    status: 'upcoming',
  },
  {
    id: '3',
    name: 'Trout Classic 2026',
    startDate: '2026-02-20',
    endDate: '2026-02-22',
    location: 'Clear Water Lake, CO',
    participants: 156,
    status: 'ongoing',
  },
  {
    id: '4',
    name: 'Northern Pike Open',
    startDate: '2026-01-15',
    endDate: '2026-01-17',
    location: 'Minnesota Lakes',
    participants: 92,
    status: 'completed',
  },
];

export const mockWeeklyTournament = {
  endsIn: '3d 13h 1m',
  anglersCompeting: 1,
  title: 'Weekly Global Tournaments',
};

export const mockWeeklyLeaderboard = {
  tabs: [
    { id: 'local', label: 'Local' },
    { id: 'global', label: 'Global', active: true },
    { id: 'mostFish', label: 'Most Fish', active: true },
    { id: 'biggestFish', label: 'Biggest Fish' },
  ],
  subtitle: 'Most fish logged this week',
  entries: [
    { username: 'jakec', fishCount: 12, rank: 1 },
  ],
};

export const mockUserProfile = {
  id: 'current-user',
  username: 'jakec',
  email: 'user@Snagged.app',
  avatar: 'https://via.placeholder.com/200x200/87CEEB/C9A84C?text=JC',
  totalCatches: 12,
  personalBest: 'Largemouth Bass - 8.5 lbs',
  favoriteLocation: 'Lake Okeechobee, FL',
  /** Display location for profile header */
  location: 'Charleston, SC',
  /** State for local tournament filtering (derived from location) */
  state: 'South Carolina',
  joinDate: '2024-06-15',
  bio: 'i like fishing',
  /** Account visibility: public = logbook viewable (bg-removed only), private = only tournament fish */
  isPublic: true,
  proVerified: true,
  /** Weekly leaderboard rank */
  weeklyRank: 1,
  /** Global leaderboard rank */
  globalRank: 247,
  wins: 0,
  top3s: 0,
  friendsCount: 0,
};

export interface TournamentBadge {
  emoji: string;
  tournamentName: string;
  date: string;
}

export interface PublicProfile {
  displayName: string;
  avatar: string;
  isPublic: boolean;
  /** Legacy: emoji strings for backward compat */
  badges: string[];
  /** Extended badges with tournament name and date */
  badgeDetails?: TournamentBadge[];
  state?: string;
  location?: string;
  xp?: number;
  proVerified?: boolean;
  bio?: string;
}

/** Mock public user profiles for viewing from leaderboard */
export const mockPublicProfiles: Record<string, PublicProfile> = {
  'user-1': {
    displayName: 'BassMaster92',
    avatar: 'https://picsum.photos/seed/avatar-bm/120/120',
    isPublic: true,
    bio: 'Bass fishing is life. Lake Okeechobee regular. 2x state champ.',
    badges: ['🥇', '🥈'],
    badgeDetails: [
      { emoji: '🥇', tournamentName: 'Spring Bass Championship', date: 'Mar 17, 2026' },
      { emoji: '🥈', tournamentName: 'Walleye Warriors Cup', date: 'Apr 12, 2026' },
    ],
    state: 'Florida',
    location: 'Lake Okeechobee, FL',
    xp: 4200,
    proVerified: true,
  },
  'user-2': {
    displayName: 'PikeHunter',
    avatar: 'https://picsum.photos/seed/avatar-ph/120/120',
    isPublic: false,
    bio: 'Northern pike specialist. Minnesota lakes. Cold water only.',
    badges: ['🥉'],
    badgeDetails: [
      { emoji: '🥉', tournamentName: 'Northern Pike Open', date: 'Jan 17, 2026' },
    ],
    state: 'Minnesota',
    location: 'Minnesota Lakes',
    xp: 2100,
    proVerified: false,
  },
  'user-3': {
    displayName: 'TroutWhisperer',
    avatar: 'https://picsum.photos/seed/avatar-tw/120/120',
    isPublic: true,
    bio: 'Fly fishing enthusiast. Rocky Mountains. Trout and more trout.',
    badges: ['🥇', '🥇'],
    badgeDetails: [
      { emoji: '🥇', tournamentName: 'Trout Classic', date: 'Feb 22, 2026' },
      { emoji: '🥇', tournamentName: 'Rocky Mountain Invitational', date: 'Sep 8, 2025' },
    ],
    state: 'Colorado',
    location: 'Rocky Mountain Region',
    xp: 6800,
    proVerified: true,
  },
  'user-4': {
    displayName: 'StripedKing',
    avatar: 'https://picsum.photos/seed/avatar-sk/120/120',
    isPublic: true,
    bio: 'Chesapeake Bay striper guy. Surf casting and boat.',
    badges: [],
    badgeDetails: [],
    state: 'Maryland',
    location: 'Chesapeake Bay, MD',
    xp: 900,
    proVerified: false,
  },
  'user-5': {
    displayName: 'WalleyeNinja',
    avatar: 'https://picsum.photos/seed/avatar-wn/120/120',
    isPublic: false,
    bio: 'Great Lakes walleye. Trolling and jigging. Pro angler.',
    badges: ['🥈'],
    badgeDetails: [
      { emoji: '🥈', tournamentName: 'Great Lakes Walleye', date: 'Jun 15, 2025' },
    ],
    state: 'Ohio',
    location: 'Great Lakes Region',
    xp: 3100,
    proVerified: true,
  },
  'user-6': {
    displayName: 'RedfishRoy',
    avatar: 'https://picsum.photos/seed/avatar-rr/120/120',
    isPublic: true,
    bio: 'Gulf Coast redfish. Inshore and nearshore. Texas born.',
    badges: [],
    badgeDetails: [],
    state: 'Texas',
    location: 'Gulf Coast, TX',
    xp: 400,
    proVerified: false,
  },
  'user-7': {
    displayName: 'PalmettoAngler',
    avatar: 'https://picsum.photos/seed/avatar-pa/120/120',
    isPublic: true,
    bio: 'Lowcountry redfish and trout. Charleston local.',
    badges: ['🥉'],
    badgeDetails: [{ emoji: '🥉', tournamentName: 'SC Redfish Classic', date: 'Aug 20, 2025' }],
    state: 'South Carolina',
    location: 'Charleston, SC',
    xp: 1800,
    proVerified: false,
  },
  'user-8': {
    displayName: 'SanteeStriper',
    avatar: 'https://picsum.photos/seed/avatar-ss/120/120',
    isPublic: true,
    bio: 'Lake Murray and Santee striper specialist.',
    badges: [],
    badgeDetails: [],
    state: 'South Carolina',
    location: 'Columbia, SC',
    xp: 950,
    proVerified: false,
  },
};

export interface FriendPreview {
  id: string;
  userId?: string;
  displayName: string;
  /** If false, user is not on app - show Invite instead of Send */
  isOnApp?: boolean;
  avatar: string;
  proVerified?: boolean;
  badges: string[];
  location?: string;
  totalCatches: number;
  personalBest: string;
  bestCatchImage?: string;
  bestSpecies?: string;
  level?: string;
  levelNumber?: number;
}

/** Mock friends list for reel-style profile preview */
export const mockFriends: FriendPreview[] = [
  {
    id: 'f1',
    userId: 'user-1',
    isOnApp: true,
    displayName: 'BassMaster92',
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=BM',
    proVerified: true,
    badges: ['🥇', '🥈'],
    location: 'Lake Okeechobee, FL',
    totalCatches: 156,
    personalBest: '12.3 lbs Largemouth',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Bass',
    bestSpecies: 'Largemouth Bass',
    level: 'Elite',
    levelNumber: 4,
  },
  {
    id: 'f2',
    userId: 'user-2',
    isOnApp: true,
    displayName: 'PikeHunter',
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=PH',
    proVerified: false,
    badges: ['🥉'],
    location: 'Minnesota Lakes',
    totalCatches: 89,
    personalBest: '34" Northern Pike',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Pike',
    bestSpecies: 'Northern Pike',
    level: 'Pro',
    levelNumber: 3,
  },
  {
    id: 'f3',
    userId: 'user-3',
    isOnApp: true,
    displayName: 'TroutWhisperer',
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=TW',
    proVerified: true,
    badges: ['🥇', '🥇'],
    location: 'Rocky Mountain Region',
    totalCatches: 203,
    personalBest: '9.5 lbs Rainbow',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Trout',
    bestSpecies: 'Rainbow Trout',
    level: 'Legend',
    levelNumber: 5,
  },
  {
    id: 'f4',
    userId: 'user-4',
    isOnApp: true,
    displayName: 'StripedKing',
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=SK',
    proVerified: false,
    badges: [],
    location: 'Chesapeake Bay, MD',
    totalCatches: 72,
    personalBest: '8.7 lbs Striped',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Striped',
    bestSpecies: 'Striped Bass',
    level: 'Angler',
    levelNumber: 2,
  },
  {
    id: 'f5',
    userId: 'user-5',
    isOnApp: true,
    displayName: 'WalleyeNinja',
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=WN',
    proVerified: true,
    badges: ['🥈'],
    location: 'Great Lakes',
    totalCatches: 134,
    personalBest: '7.2 lbs Walleye',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Walleye',
    bestSpecies: 'Walleye',
    level: 'Pro',
    levelNumber: 3,
  },
  {
    id: 'f6',
    displayName: 'RedfishRoy',
    isOnApp: false,
    avatar: 'https://via.placeholder.com/120x120/C9A84C/0A0A0A?text=RR',
    proVerified: false,
    badges: [],
    location: 'Gulf Coast, TX',
    totalCatches: 67,
    personalBest: '38" Redfish',
    bestCatchImage: 'https://via.placeholder.com/280x180/0A0A0A/C9A84C?text=Redfish',
    bestSpecies: 'Redfish',
    level: 'Rookie',
    levelNumber: 1,
  },
];
