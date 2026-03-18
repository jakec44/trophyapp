/**
 * Fish icon system for the Species Passport.
 *
 * LOCKED  (not yet caught) → monochrome silhouette, gray fill
 * UNLOCKED (caught)        → same path, accent-blue fill + eye dot + detail lines
 *
 * All icons use viewBox "0 0 120 70", consistent stroke weight, same bounding box.
 * No image assets, no remote URLs — pure react-native-svg vector paths.
 */

import React, { memo } from 'react';
import Svg, { Path, Circle, Line, Ellipse } from 'react-native-svg';

// ─────────────────────────────────────────────────────────────────────────────
// SVG path data — one body-path per species (viewBox 0 0 120 70)
// Fish faces left; snout on left, tail on right.
// ─────────────────────────────────────────────────────────────────────────────

const PATHS: Record<string, string> = {
  // ── SALTWATER ──────────────────────────────────────────────────────────────

  'red-drum':
    'M 12,35 C 14,18 38,5 70,8 C 84,5 96,16 100,27 L 118,18 L 108,35 L 118,52 L 100,43 C 96,54 84,65 70,62 C 38,65 14,52 12,35 Z',

  snook:
    'M 5,37 L 20,48 L 14,37 C 12,22 32,9 65,11 C 82,9 94,18 98,30 L 118,17 L 106,35 L 118,53 L 98,40 C 94,52 82,62 65,60 C 32,62 12,48 5,37 Z',

  'spotted-seatrout':
    'M 8,35 C 10,22 32,10 62,12 C 78,10 89,19 93,29 L 115,15 L 103,35 L 115,55 L 93,41 C 89,51 78,60 62,58 C 32,60 10,48 8,35 Z',

  flounder:
    'M 8,35 C 8,13 22,3 54,3 C 86,3 106,15 110,29 L 118,24 L 111,35 L 118,46 L 110,41 C 106,57 86,67 54,67 C 22,67 8,57 8,35 Z',

  sheepshead:
    'M 18,35 C 18,11 40,1 65,3 C 80,1 92,14 95,27 L 114,19 L 105,35 L 114,51 L 95,43 C 92,57 80,69 65,67 C 40,69 18,59 18,35 Z',

  'black-drum':
    'M 11,35 C 11,15 35,2 68,5 C 85,2 97,13 101,27 L 118,20 L 110,35 L 118,50 L 101,43 C 97,57 85,68 68,65 C 35,68 11,55 11,35 Z',

  'spanish-mackerel':
    'M 5,35 C 8,25 30,16 64,17 C 80,15 91,22 96,30 L 116,13 L 105,35 L 116,57 L 96,40 C 91,48 80,55 64,53 C 30,54 8,45 5,35 Z',

  'king-mackerel':
    'M 4,35 C 6,26 25,16 60,18 C 78,16 91,23 96,30 L 118,10 L 106,35 L 118,60 L 96,40 C 91,48 78,55 60,53 C 25,54 6,44 4,35 Z',

  pompano:
    'M 20,35 C 20,12 43,1 67,3 C 83,1 95,14 98,27 L 116,17 L 107,35 L 116,53 L 98,43 C 95,56 83,69 67,67 C 43,69 20,58 20,35 Z',

  'jack-crevalle':
    'M 16,35 C 18,14 40,3 66,5 C 82,3 94,15 98,27 L 118,14 L 106,35 L 118,56 L 98,43 C 94,57 82,67 66,65 C 40,67 18,56 16,35 Z',

  ladyfish:
    'M 6,35 C 8,25 28,16 58,18 C 72,16 82,22 86,30 L 110,16 L 100,35 L 110,54 L 86,40 C 82,48 72,54 58,52 C 28,54 8,45 6,35 Z',

  bluefish:
    'M 8,35 C 8,21 26,10 52,12 C 68,10 82,18 88,28 L 112,14 L 100,35 L 112,56 L 88,42 C 82,52 68,60 52,58 C 26,60 8,49 8,35 Z',

  tarpon:
    'M 8,33 C 10,16 36,4 68,8 C 84,5 96,16 100,27 L 118,15 L 106,33 L 118,51 L 100,43 C 96,54 84,65 68,62 C 36,66 10,50 8,33 Z',

  'mahi-mahi':
    'M 8,30 C 8,10 18,2 32,3 C 50,3 72,8 84,17 C 92,23 94,30 92,35 L 116,22 L 104,35 L 116,48 L 92,35 C 94,40 92,48 84,53 C 72,62 50,67 32,57 C 18,57 8,50 8,30 Z',

  cobia:
    'M 5,35 C 6,25 22,17 46,18 C 64,16 82,22 88,28 L 110,16 L 100,35 L 110,54 L 88,42 C 82,48 64,54 46,52 C 22,53 6,45 5,35 Z',

  'red-snapper':
    'M 8,35 C 10,19 32,7 60,9 C 76,7 88,16 93,27 L 115,14 L 103,35 L 115,56 L 93,43 C 88,54 76,63 60,61 C 32,63 10,51 8,35 Z',

  'mangrove-snapper':
    'M 8,35 C 10,20 32,8 60,10 C 76,8 88,17 93,28 L 115,15 L 103,35 L 115,55 L 93,42 C 88,53 76,62 60,60 C 32,62 10,50 8,35 Z',

  'yellowtail-snapper':
    'M 7,35 C 9,21 30,9 58,11 C 74,9 86,18 92,29 L 114,15 L 102,35 L 114,55 L 92,41 C 86,52 74,61 58,59 C 30,61 9,49 7,35 Z',

  'vermillion-snapper':
    'M 8,35 C 10,19 32,7 60,9 C 76,7 88,16 93,27 L 115,14 L 103,35 L 115,56 L 93,43 C 88,54 76,63 60,61 C 32,63 10,51 8,35 Z',

  amberjack:
    'M 7,35 C 9,21 28,9 58,11 C 75,9 87,17 92,27 L 114,14 L 102,35 L 114,56 L 92,43 C 87,53 75,61 58,59 C 28,61 9,49 7,35 Z',

  grouper:
    'M 8,35 C 8,18 28,5 58,7 C 75,5 88,14 93,26 L 110,22 L 104,35 L 110,48 L 93,44 C 88,56 75,65 58,63 C 28,65 8,52 8,35 Z',

  'striped-bass':
    'M 7,35 C 8,20 28,8 58,10 C 76,8 89,17 93,28 L 115,14 L 103,35 L 115,56 L 93,42 C 89,53 76,62 58,60 C 28,62 8,50 7,35 Z',

  weakfish:
    'M 8,35 C 10,22 32,10 60,12 C 77,10 89,19 94,29 L 115,15 L 103,35 L 115,55 L 94,41 C 89,51 77,60 60,58 C 32,60 10,48 8,35 Z',

  barracuda:
    'M 2,35 C 3,30 14,24 38,25 C 60,23 82,28 92,32 L 116,20 L 106,35 L 116,50 L 92,38 C 82,42 60,47 38,45 C 14,46 3,40 2,35 Z',

  triggerfish:
    'M 18,35 C 18,12 38,1 64,3 C 80,1 93,14 96,30 C 96,50 80,67 64,67 C 38,67 18,58 18,35 Z',

  'sea-bass':
    'M 9,35 C 11,20 32,8 60,10 C 76,8 87,17 92,28 L 113,15 L 101,35 L 113,55 L 92,42 C 87,53 76,62 60,60 C 32,62 11,50 9,35 Z',

  porgy:
    'M 14,35 C 14,14 35,2 60,4 C 78,2 92,14 96,28 L 114,20 L 106,35 L 114,50 L 96,42 C 92,56 78,68 60,66 C 35,68 14,56 14,35 Z',

  hogfish:
    'M 10,35 C 10,20 22,8 40,5 C 55,3 72,5 84,12 C 92,18 96,28 94,35 L 115,22 L 104,35 L 115,48 L 94,35 C 96,42 92,52 84,58 C 72,65 55,67 40,65 C 22,62 10,50 10,35 Z',

  tripletail:
    'M 14,35 C 14,15 36,3 64,5 C 80,3 92,14 96,28 L 115,20 L 108,35 L 115,50 L 96,42 C 92,56 80,67 64,65 C 36,67 14,55 14,35 Z',

  bonefish:
    'M 5,35 C 7,23 26,12 54,14 C 70,12 83,20 88,29 L 112,16 L 100,35 L 112,54 L 88,41 C 83,50 70,58 54,56 C 26,58 7,47 5,35 Z',

  permit:
    'M 22,35 C 22,11 44,1 68,3 C 84,1 96,14 99,27 L 117,17 L 108,35 L 117,53 L 99,43 C 96,57 84,69 68,67 C 44,69 22,59 22,35 Z',

  pinfish:
    'M 14,35 C 14,14 34,2 58,4 C 78,2 92,14 96,28 L 114,20 L 106,35 L 114,50 L 96,42 C 92,56 78,68 58,66 C 34,68 14,56 14,35 Z',
  stingray:
    'M 12,35 C 12,18 30,8 55,10 C 75,8 90,16 96,28 C 100,35 100,35 96,42 C 90,54 75,62 55,60 C 30,62 12,52 12,35 Z',
  pigfish:
    'M 12,35 C 14,18 34,6 60,8 C 78,6 90,15 94,27 L 114,16 L 102,35 L 114,54 L 94,43 C 90,55 78,64 60,62 C 34,64 14,52 12,35 Z',
  pufferfish:
    'M 30,35 C 30,15 45,5 60,5 C 75,5 90,15 90,35 C 90,55 75,65 60,65 C 45,65 30,55 30,35 Z',
  wahoo:
    'M 4,35 C 6,26 24,16 58,18 C 78,16 92,23 96,30 L 118,12 L 106,35 L 118,58 L 96,40 C 92,48 78,55 58,53 C 24,54 6,44 4,35 Z',
  'yellowfin-tuna':
    'M 6,35 C 8,22 28,10 55,12 C 74,10 88,18 93,28 L 115,13 L 103,35 L 115,57 L 93,43 C 88,54 74,62 55,60 C 28,62 8,50 6,35 Z',
  'bluefin-tuna':
    'M 6,35 C 8,21 28,9 55,11 C 74,9 88,17 93,27 L 115,12 L 103,35 L 115,58 L 93,44 C 88,55 74,63 55,61 C 28,63 8,51 6,35 Z',
  kingfish:
    'M 4,35 C 6,26 25,16 60,18 C 78,16 91,23 96,30 L 118,10 L 106,35 L 118,60 L 96,40 C 91,48 78,55 60,53 C 25,54 6,44 4,35 Z',
  sailfish:
    'M 2,35 C 4,28 18,22 45,22 C 70,20 95,25 108,30 L 118,18 L 108,35 L 118,52 L 108,40 C 95,45 70,50 45,48 C 18,48 4,42 2,35 Z',
  'white-marlin':
    'M 4,35 C 6,28 20,22 48,22 C 72,20 95,25 106,30 L 118,18 L 108,35 L 118,52 L 106,40 C 95,45 72,50 48,48 C 20,48 6,42 4,35 Z',

  // ── FRESHWATER ─────────────────────────────────────────────────────────────

  'largemouth-bass':
    'M 7,35 C 7,20 20,8 44,9 C 64,7 82,15 90,26 L 112,13 L 100,35 L 112,57 L 90,44 C 82,55 64,63 44,61 C 20,61 7,50 7,35 Z',

  'smallmouth-bass':
    'M 8,35 C 9,21 25,9 50,10 C 68,8 84,16 90,26 L 112,14 L 101,35 L 112,56 L 90,44 C 84,54 68,62 50,60 C 25,61 9,49 8,35 Z',

  'spotted-bass':
    'M 8,35 C 9,21 26,9 52,10 C 70,8 84,16 90,26 L 112,14 L 101,35 L 112,56 L 90,44 C 84,54 70,62 52,60 C 26,61 9,49 8,35 Z',

  'crappie-black':
    'M 14,35 C 14,15 35,3 60,5 C 77,3 90,14 94,27 L 113,18 L 104,35 L 113,52 L 94,43 C 90,56 77,67 60,65 C 35,67 14,55 14,35 Z',

  'crappie-white':
    'M 14,35 C 14,15 36,3 62,5 C 78,3 91,14 95,27 L 114,18 L 105,35 L 114,52 L 95,43 C 91,56 78,67 62,65 C 36,67 14,55 14,35 Z',

  bluegill:
    'M 14,35 C 14,14 34,2 58,2 C 82,2 98,14 104,28 L 116,22 L 108,35 L 116,48 L 104,42 C 98,56 82,68 58,68 C 34,68 14,56 14,35 Z',

  pumpkinseed:
    'M 14,35 C 14,14 34,2 58,2 C 82,2 98,14 104,28 L 116,22 L 108,35 L 116,48 L 104,42 C 98,56 82,68 58,68 C 34,68 14,56 14,35 Z',

  'channel-catfish':
    'M 6,35 C 6,24 18,15 40,16 C 58,14 76,20 84,28 L 108,15 L 97,35 L 108,55 L 84,42 C 76,50 58,56 40,54 C 18,53 6,46 6,35 Z',

  'flathead-catfish':
    'M 4,35 C 4,27 12,20 32,20 C 50,18 72,22 82,28 L 104,22 L 96,35 L 104,48 L 82,42 C 72,48 50,52 32,50 C 12,50 4,43 4,35 Z',

  'blue-catfish':
    'M 6,35 C 6,23 18,14 40,15 C 58,13 76,20 84,28 L 108,15 L 97,35 L 108,55 L 84,42 C 76,50 58,57 40,55 C 18,54 6,47 6,35 Z',

  walleye:
    'M 6,35 C 8,21 28,10 55,12 C 72,10 84,18 90,28 L 112,15 L 100,35 L 112,55 L 90,42 C 84,52 72,60 55,58 C 28,60 8,49 6,35 Z',

  'northern-pike':
    'M 2,35 C 3,27 14,21 38,22 C 58,20 80,25 90,30 L 114,19 L 103,35 L 114,51 L 90,40 C 80,45 58,50 38,48 C 14,49 3,43 2,35 Z',

  'rainbow-trout':
    'M 8,35 C 10,21 32,9 62,11 C 78,9 89,18 94,28 L 115,14 L 103,35 L 115,56 L 94,42 C 89,52 78,61 62,59 C 32,61 10,49 8,35 Z',

  'brown-trout':
    'M 8,35 C 10,22 32,10 62,12 C 78,10 89,19 94,29 L 115,15 L 103,35 L 115,55 L 94,41 C 89,51 78,60 62,58 C 32,60 10,48 8,35 Z',

  'brook-trout':
    'M 9,35 C 11,22 33,10 62,12 C 78,10 89,19 94,29 L 114,15 L 102,35 L 114,55 L 94,41 C 89,51 78,60 62,58 C 33,60 11,48 9,35 Z',

  'tiger-trout':
    'M 8,35 C 10,22 32,10 62,12 C 78,10 89,19 94,29 L 115,15 L 103,35 L 115,55 L 94,41 C 89,51 78,60 62,58 C 32,60 10,48 8,35 Z',

  muskie:
    'M 2,35 C 3,28 12,22 35,22 C 55,20 80,25 92,30 L 116,18 L 104,35 L 116,52 L 92,40 C 80,45 55,50 35,48 C 12,48 3,42 2,35 Z',

  carp:
    'M 12,38 C 12,18 36,5 68,7 C 84,4 97,14 100,27 L 118,21 L 110,35 L 118,49 L 100,43 C 97,56 84,66 68,64 C 36,67 12,52 12,38 Z',

  'grass-carp':
    'M 12,38 C 12,18 36,5 68,7 C 84,4 97,14 100,27 L 118,21 L 110,35 L 118,49 L 100,43 C 97,56 84,66 68,64 C 36,67 12,52 12,38 Z',

  'white-bass':
    'M 8,35 C 10,21 30,9 56,11 C 73,9 85,17 91,27 L 113,14 L 101,35 L 113,56 L 91,43 C 85,53 73,61 56,59 C 30,61 10,49 8,35 Z',

  'yellow-perch':
    'M 9,35 C 11,21 32,9 58,11 C 75,9 86,17 91,27 L 113,14 L 101,35 L 113,56 L 91,43 C 86,53 75,61 58,59 C 32,61 11,49 9,35 Z',

  'drum-freshwater':
    'M 12,35 C 12,16 36,3 68,7 C 84,4 96,14 100,27 L 118,20 L 110,35 L 118,50 L 100,43 C 96,56 84,66 68,63 C 36,67 12,54 12,35 Z',

  gar: 'M 2,35 C 2,31 8,27 20,27 C 40,25 65,29 88,31 L 114,23 L 104,35 L 114,47 L 88,39 C 65,41 40,45 20,43 C 8,43 2,39 2,35 Z',
  bowfin: 'M 6,35 C 6,24 20,14 45,14 C 68,12 88,20 94,30 L 112,18 L 101,35 L 112,52 L 94,40 C 88,52 68,60 45,56 C 20,56 6,46 6,35 Z',
  'american-shad': 'M 8,35 C 10,21 30,9 56,11 C 73,9 85,17 91,27 L 113,14 L 101,35 L 113,56 L 91,43 C 85,53 73,61 56,59 C 30,61 10,49 8,35 Z',
  'threadfin-shad': 'M 12,35 C 14,22 34,10 60,12 C 76,10 88,19 93,29 L 113,16 L 102,35 L 113,54 L 93,41 C 88,51 76,60 60,58 C 34,60 14,48 12,35 Z',
  'white-perch': 'M 10,35 C 12,21 32,9 58,11 C 75,9 86,18 92,28 L 114,15 L 102,35 L 114,55 L 92,42 C 86,52 75,61 58,59 C 32,61 12,49 10,35 Z',
  pickerel: 'M 4,35 C 5,28 16,22 40,22 C 60,20 82,25 92,30 L 116,19 L 104,35 L 116,51 L 92,40 C 82,45 60,50 40,48 C 16,49 5,42 4,35 Z',
  warmouth: 'M 14,35 C 14,14 34,2 58,2 C 82,2 98,14 104,28 L 116,22 L 108,35 L 116,48 L 104,42 C 98,56 82,68 58,68 C 34,68 14,56 14,35 Z',
  'peacock-bass': 'M 7,35 C 7,20 22,8 48,10 C 68,8 84,16 90,26 L 112,14 L 100,35 L 112,56 L 90,44 C 84,54 68,62 48,60 C 22,61 7,50 7,35 Z',
  snakehead: 'M 6,35 C 6,24 20,14 45,14 C 68,12 88,20 94,30 L 112,18 L 101,35 L 112,52 L 94,40 C 88,52 68,60 45,56 C 20,56 6,46 6,35 Z',
  'clown-knifefish': 'M 6,35 C 6,24 20,14 45,14 C 68,12 88,20 94,30 L 112,18 L 101,35 L 112,52 L 94,40 C 88,52 68,60 45,56 C 20,56 6,46 6,35 Z',
  'white-sturgeon': 'M 8,35 C 8,28 16,22 36,22 C 56,20 80,24 92,28 L 112,20 L 102,35 L 112,50 L 92,42 C 80,48 56,52 36,48 C 16,48 8,42 8,35 Z',
  'atlantic-sturgeon': 'M 6,35 C 6,28 14,22 34,22 C 54,20 78,24 90,28 L 110,20 L 100,35 L 110,50 L 90,42 C 78,48 54,52 34,48 C 14,48 6,42 6,35 Z',
  steelhead: 'M 8,35 C 10,21 32,9 62,11 C 78,9 89,18 94,28 L 115,14 L 103,35 L 115,56 L 94,42 C 89,52 78,61 62,59 C 32,61 10,49 8,35 Z',
  salmon: 'M 8,35 C 10,19 32,7 62,9 C 78,7 90,16 95,27 L 116,13 L 104,35 L 116,57 L 95,43 C 90,54 78,63 62,61 C 32,63 10,51 8,35 Z',
  tilapia: 'M 10,35 C 12,20 32,8 58,10 C 75,8 87,16 92,27 L 114,15 L 102,35 L 114,55 L 92,42 C 87,52 75,60 58,58 C 32,60 12,48 10,35 Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-species eye position (cx, cy) in viewBox coords.
// Used for both locked and unlocked states.
// ─────────────────────────────────────────────────────────────────────────────

const EYE_POS: Record<string, [number, number]> = {
  'red-drum': [26, 31],
  snook: [24, 31],
  'spotted-seatrout': [22, 30],
  flounder: [20, 24],
  sheepshead: [32, 27],
  'black-drum': [24, 28],
  'spanish-mackerel': [18, 30],
  'king-mackerel': [16, 30],
  pompano: [36, 27],
  'jack-crevalle': [34, 27],
  ladyfish: [18, 31],
  bluefish: [20, 30],
  tarpon: [24, 27],
  'mahi-mahi': [20, 22],
  cobia: [18, 31],
  'red-snapper': [22, 27],
  'mangrove-snapper': [22, 28],
  'yellowtail-snapper': [20, 28],
  'vermillion-snapper': [22, 27],
  amberjack: [20, 28],
  grouper: [22, 26],
  'striped-bass': [20, 28],
  weakfish: [22, 30],
  barracuda: [12, 34],
  triggerfish: [32, 27],
  'sea-bass': [22, 28],
  porgy: [26, 27],
  hogfish: [22, 27],
  tripletail: [28, 26],
  bonefish: [18, 31],
  permit: [38, 27],
  pinfish: [28, 27],
  stingray: [28, 32],
  pigfish: [26, 29],
  pufferfish: [36, 35],
  wahoo: [18, 30],
  'yellowfin-tuna': [22, 30],
  'bluefin-tuna': [22, 30],
  kingfish: [16, 30],
  sailfish: [24, 33],
  'white-marlin': [22, 33],
  'largemouth-bass': [20, 27],
  'smallmouth-bass': [22, 28],
  'spotted-bass': [22, 28],
  'crappie-black': [28, 26],
  'crappie-white': [28, 26],
  bluegill: [28, 25],
  pumpkinseed: [28, 25],
  'channel-catfish': [18, 30],
  'flathead-catfish': [14, 32],
  'blue-catfish': [18, 30],
  walleye: [20, 30],
  'northern-pike': [12, 33],
  'rainbow-trout': [22, 29],
  'brown-trout': [22, 30],
  'brook-trout': [22, 30],
  'tiger-trout': [22, 29],
  muskie: [12, 33],
  carp: [24, 33],
  'grass-carp': [24, 33],
  'white-bass': [22, 29],
  'yellow-perch': [22, 29],
  'drum-freshwater': [26, 30],
  gar: [10, 35],
  bowfin: [22, 30],
  'american-shad': [22, 29],
  'threadfin-shad': [24, 30],
  'white-perch': [24, 29],
  pickerel: [14, 33],
  warmouth: [28, 25],
  'peacock-bass': [22, 28],
  snakehead: [22, 30],
  'clown-knifefish': [22, 30],
  'white-sturgeon': [20, 32],
  'atlantic-sturgeon': [18, 32],
  steelhead: [22, 29],
  salmon: [22, 29],
  tilapia: [22, 29],
};

const GENERIC_PATH =
  'M 10,35 C 12,20 32,8 60,10 C 76,8 88,16 94,28 L 114,14 L 103,35 L 114,56 L 94,42 C 88,54 76,62 60,60 C 32,62 12,50 10,35 Z';

// ─────────────────────────────────────────────────────────────────────────────
// FishIcon component
// ─────────────────────────────────────────────────────────────────────────────

interface FishIconProps {
  speciesId: string;
  caught: boolean;
  size?: number;
  lockedColor?: string;
  caughtColor?: string;
}

export const FishIcon = memo(function FishIcon({
  speciesId,
  caught,
  size = 56,
  lockedColor = '#B0B8C8',
  caughtColor = '#1D9BF0',
}: FishIconProps) {
  const path = PATHS[speciesId] ?? GENERIC_PATH;
  const eyePos = EYE_POS[speciesId] ?? [22, 30];

  const fill = caught ? caughtColor : lockedColor;
  const eyeFill = caught ? '#FFFFFF' : '#8A9BB0';
  // Eye radius scales very slightly with overall size
  const eyeR = size < 44 ? 1.4 : 1.8;

  // Scale from viewBox 120x70 to desired size maintaining aspect ratio
  const vbW = 120;
  const vbH = 70;
  const aspect = vbW / vbH;
  const w = size * aspect;
  const h = size;

  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 120 70"
      style={{ overflow: 'visible' }}
    >
      {/* Body silhouette */}
      <Path d={path} fill={fill} />

      {/* Eye */}
      <Circle
        cx={eyePos[0]}
        cy={eyePos[1]}
        r={eyeR}
        fill={eyeFill}
      />

      {/* Detail lines — only when caught (unlocked) */}
      {caught && <CaughtDetails speciesId={speciesId} />}
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Detail overlay for the "caught" state — adds species-specific markings
// so each unlocked tile looks unique beyond just color.
// ─────────────────────────────────────────────────────────────────────────────

function CaughtDetails({ speciesId }: { speciesId: string }) {
  const lineColor = 'rgba(255,255,255,0.35)';
  const sw = 1.2;

  // Spot marking — only for species that have one
  const SPOT_SPECIES = new Set(['red-drum', 'spotted-seatrout', 'brown-trout', 'brook-trout']);
  const showSpot = SPOT_SPECIES.has(speciesId);

  // Stripe species (vertical bars)
  const STRIPE_SPECIES = new Set(['sheepshead', 'striped-bass', 'yellow-perch', 'white-bass']);
  const showStripes = STRIPE_SPECIES.has(speciesId);

  // Lateral line
  const LATERAL_LINE_SPECIES = new Set(['snook', 'striped-bass', 'barracuda', 'gar']);
  const showLateral = LATERAL_LINE_SPECIES.has(speciesId);

  return (
    <>
      {/* Gill line — universal detail */}
      <Path
        d="M 30,18 Q 32,35 30,52"
        stroke={lineColor}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />

      {/* Spot at tail base */}
      {showSpot && (
        <Ellipse
          cx={80}
          cy={35}
          rx={5}
          ry={5}
          fill="rgba(0,0,0,0.25)"
        />
      )}

      {/* Vertical stripes */}
      {showStripes && (
        <>
          <Line x1={42} y1={12} x2={40} y2={58} stroke={lineColor} strokeWidth={sw + 0.4} strokeLinecap="round" />
          <Line x1={54} y1={9} x2={52} y2={61} stroke={lineColor} strokeWidth={sw + 0.4} strokeLinecap="round" />
          <Line x1={66} y1={8} x2={64} y2={62} stroke={lineColor} strokeWidth={sw + 0.4} strokeLinecap="round" />
        </>
      )}

      {/* Lateral line */}
      {showLateral && (
        <Path
          d="M 35,32 Q 60,30 88,33"
          stroke={lineColor}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 2"
        />
      )}
    </>
  );
}
