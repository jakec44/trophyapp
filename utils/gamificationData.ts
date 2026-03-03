/**
 * Mock data for gamification: XP, streak, passport species, notifications
 */

import type { PassportSpecies } from '@/src/types/gamification';

export const MOCK_XP = 1250;
export const MOCK_TOTAL_CATCHES = 12;
export const MOCK_TOURNAMENTS_ENTERED = 5;
export const MOCK_PERSONAL_RECORDS = 2;

export const MOCK_STREAK = 7;
export const MOCK_LAST_CATCH_DATE = new Date().toISOString().slice(0, 10);

/** 53 saltwater + 32 freshwater species (North American accessible to young anglers 16-35) */
export const PASSPORT_SPECIES: PassportSpecies[] = [
  // Saltwater
  { id: 'red-drum', name: 'Red Drum (Redfish)', category: 'saltwater', rarity: 'uncommon' },
  { id: 'snook', name: 'Snook', category: 'saltwater', rarity: 'rare' },
  { id: 'spotted-seatrout', name: 'Spotted Seatrout', category: 'saltwater', rarity: 'uncommon' },
  { id: 'flounder', name: 'Flounder', category: 'saltwater', rarity: 'uncommon' },
  { id: 'sheepshead', name: 'Sheepshead', category: 'saltwater', rarity: 'rare' },
  { id: 'black-drum', name: 'Black Drum', category: 'saltwater', rarity: 'common' },
  { id: 'spanish-mackerel', name: 'Spanish Mackerel', category: 'saltwater', rarity: 'rare' },
  { id: 'king-mackerel', name: 'King Mackerel', category: 'saltwater', rarity: 'epic' },
  { id: 'pompano', name: 'Pompano', category: 'saltwater', rarity: 'rare' },
  { id: 'jack-crevalle', name: 'Jack Crevalle', category: 'saltwater', rarity: 'rare' },
  { id: 'ladyfish', name: 'Ladyfish', category: 'saltwater', rarity: 'common' },
  { id: 'bluefish', name: 'Bluefish', category: 'saltwater', rarity: 'common' },
  { id: 'tarpon', name: 'Tarpon', category: 'saltwater', rarity: 'legendary' },
  { id: 'mahi-mahi', name: 'Mahi Mahi', category: 'saltwater', rarity: 'legendary' },
  { id: 'cobia', name: 'Cobia', category: 'saltwater', rarity: 'epic' },
  { id: 'red-snapper', name: 'Red Snapper', category: 'saltwater', rarity: 'rare' },
  { id: 'mangrove-snapper', name: 'Mangrove Snapper', category: 'saltwater', rarity: 'rare' },
  { id: 'yellowtail-snapper', name: 'Yellowtail Snapper', category: 'saltwater', rarity: 'rare' },
  { id: 'amberjack', name: 'Amberjack', category: 'saltwater', rarity: 'epic' },
  { id: 'grouper', name: 'Grouper', category: 'saltwater', rarity: 'epic' },
  { id: 'striped-bass', name: 'Striped Bass', category: 'saltwater', rarity: 'common' },
  { id: 'weakfish', name: 'Weakfish', category: 'saltwater', rarity: 'common' },
  { id: 'barracuda', name: 'Barracuda', category: 'saltwater', rarity: 'rare' },
  { id: 'triggerfish', name: 'Triggerfish', category: 'saltwater', rarity: 'epic' },
  { id: 'sea-bass', name: 'Sea Bass', category: 'saltwater', rarity: 'common' },
  { id: 'porgy', name: 'Porgy', category: 'saltwater', rarity: 'common' },
  { id: 'hogfish', name: 'Hogfish', category: 'saltwater', rarity: 'epic' },
  { id: 'tripletail', name: 'Tripletail', category: 'saltwater', rarity: 'rare' },
  { id: 'bonefish', name: 'Bonefish', category: 'saltwater', rarity: 'epic' },
  { id: 'permit', name: 'Permit', category: 'saltwater', rarity: 'epic' },
  { id: 'bonito', name: 'Bonito', category: 'saltwater', rarity: 'common' },
  { id: 'whiting', name: 'Whiting', category: 'saltwater', rarity: 'common' },
  { id: 'pinfish', name: 'Pinfish', category: 'saltwater', rarity: 'common' },
  { id: 'stingray', name: 'Stingray', category: 'saltwater', rarity: 'common' },
  { id: 'pigfish', name: 'Pigfish', category: 'saltwater', rarity: 'common' },
  { id: 'pufferfish', name: 'Pufferfish', category: 'saltwater', rarity: 'common' },
  { id: 'wahoo', name: 'Wahoo', category: 'saltwater', rarity: 'mythic' },
  { id: 'yellowfin-tuna', name: 'Yellowfin Tuna', category: 'saltwater', rarity: 'mythic' },
  { id: 'bluefin-tuna', name: 'Bluefin Tuna', category: 'saltwater', rarity: 'mythic' },
  { id: 'kingfish', name: 'Kingfish', category: 'saltwater', rarity: 'rare' },
  { id: 'sailfish', name: 'Sailfish', category: 'saltwater', rarity: 'mythic' },
  { id: 'white-marlin', name: 'White Marlin', category: 'saltwater', rarity: 'mythic' },
  { id: 'toadfish', name: 'Toadfish', category: 'saltwater', rarity: 'common' },
  { id: 'croaker', name: 'Croaker', category: 'saltwater', rarity: 'common' },
  { id: 'sandbar-shark', name: 'Sandbar Shark', category: 'saltwater', rarity: 'rare' },
  { id: 'blacktip-shark', name: 'Blacktip Shark', category: 'saltwater', rarity: 'rare' },
  { id: 'spinner-shark', name: 'Spinner Shark', category: 'saltwater', rarity: 'rare' },
  { id: 'bonnethead-shark', name: 'Bonnethead Shark', category: 'saltwater', rarity: 'uncommon' },
  { id: 'sharpnose-shark', name: 'Sharpnose Shark', category: 'saltwater', rarity: 'uncommon' },
  { id: 'hammerhead-shark', name: 'Hammerhead Shark', category: 'saltwater', rarity: 'mythic' },
  { id: 'mako-shark', name: 'Mako Shark', category: 'saltwater', rarity: 'mythic' },
  { id: 'bull-shark', name: 'Bull Shark', category: 'saltwater', rarity: 'epic' },
  { id: 'tiger-shark', name: 'Tiger Shark', category: 'saltwater', rarity: 'mythic' },
  { id: 'thresher-shark', name: 'Thresher Shark', category: 'saltwater', rarity: 'mythic' },
  // Freshwater
  { id: 'bluegill', name: 'Bluegill', category: 'freshwater', rarity: 'common' },
  { id: 'crappie-black', name: 'Crappie (Black)', category: 'freshwater', rarity: 'rare' },
  { id: 'crappie-white', name: 'Crappie (White)', category: 'freshwater', rarity: 'rare' },
  { id: 'yellow-perch', name: 'Yellow Perch', category: 'freshwater', rarity: 'epic' },
  { id: 'carp', name: 'Carp', category: 'freshwater', rarity: 'uncommon' },
  { id: 'drum-freshwater', name: 'Drum (Freshwater)', category: 'freshwater', rarity: 'rare' },
  { id: 'channel-catfish', name: 'Channel Catfish', category: 'freshwater', rarity: 'uncommon' },
  { id: 'white-bass', name: 'White Bass', category: 'freshwater', rarity: 'epic' },
  { id: 'largemouth-bass', name: 'Largemouth Bass', category: 'freshwater', rarity: 'uncommon' },
  { id: 'smallmouth-bass', name: 'Smallmouth Bass', category: 'freshwater', rarity: 'uncommon' },
  { id: 'spotted-bass', name: 'Spotted Bass', category: 'freshwater', rarity: 'uncommon' },
  { id: 'rainbow-trout', name: 'Rainbow Trout', category: 'freshwater', rarity: 'rare' },
  { id: 'brook-trout', name: 'Brook Trout', category: 'freshwater', rarity: 'rare' },
  { id: 'walleye', name: 'Walleye', category: 'freshwater', rarity: 'epic' },
  { id: 'brown-trout', name: 'Brown Trout', category: 'freshwater', rarity: 'epic' },
  { id: 'northern-pike', name: 'Northern Pike', category: 'freshwater', rarity: 'rare' },
  { id: 'flathead-catfish', name: 'Flathead Catfish', category: 'freshwater', rarity: 'uncommon' },
  { id: 'blue-catfish', name: 'Blue Catfish', category: 'freshwater', rarity: 'uncommon' },
  { id: 'gar', name: 'Gar', category: 'freshwater', rarity: 'epic' },
  { id: 'muskie', name: 'Muskie', category: 'freshwater', rarity: 'mythic' },
  { id: 'bowfin', name: 'Bowfin', category: 'freshwater', rarity: 'epic' },
  { id: 'american-shad', name: 'American Shad', category: 'freshwater', rarity: 'common' },
  { id: 'threadfin-shad', name: 'Threadfin Shad', category: 'freshwater', rarity: 'common' },
  { id: 'white-perch', name: 'White Perch', category: 'freshwater', rarity: 'common' },
  { id: 'pickerel', name: 'Pickerel', category: 'freshwater', rarity: 'rare' },
  { id: 'warmouth', name: 'Warmouth', category: 'freshwater', rarity: 'uncommon' },
  { id: 'peacock-bass', name: 'Peacock Bass', category: 'freshwater', rarity: 'rare' },
  { id: 'snakehead', name: 'Snakehead', category: 'freshwater', rarity: 'epic' },
  { id: 'white-sturgeon', name: 'White Sturgeon', category: 'freshwater', rarity: 'mythic' },
  { id: 'atlantic-sturgeon', name: 'Atlantic Sturgeon', category: 'freshwater', rarity: 'mythic' },
  { id: 'steelhead', name: 'Steelhead', category: 'freshwater', rarity: 'epic' },
  { id: 'tilapia', name: 'Tilapia', category: 'freshwater', rarity: 'common' },
];

/** 5 species already caught (mock data) */
export const MOCK_CAUGHT_SPECIES_IDS = [
  'red-drum',
  'snook',
  'largemouth-bass',
  'bluegill',
  'rainbow-trout',
];

/** Mock dates caught for the 5 mock species (YYYY-MM-DD) */
export const MOCK_CAUGHT_DATES: Record<string, string> = {
  'red-drum': '2025-01-15',
  'snook': '2025-02-02',
  'largemouth-bass': '2024-11-20',
  'bluegill': '2024-12-05',
  'rainbow-trout': '2025-02-10',
};

export const MOCK_NOTIFICATIONS = [
  {
    id: 'n1',
    friendName: 'BassMaster92',
    species: 'Largemouth Bass',
    friendCatchValue: '8.2 lbs',
    yourPreviousBest: '7.5 lbs',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    friendName: 'TroutWhisperer',
    species: 'Rainbow Trout',
    friendCatchValue: '22"',
    yourPreviousBest: '20"',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'n3',
    friendName: 'PikeHunter',
    species: 'Northern Pike',
    friendCatchValue: '12.1 lbs',
    yourPreviousBest: '10.5 lbs',
    read: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];
