import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  Image,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { useAuthContext } from '@/src/context/AuthContext';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import type { SpeciesRarity } from '@/src/types/gamification';
import { RARITY_ORDER } from '@/src/types/gamification';

const RARITY_COLORS: Record<SpeciesRarity, string> = {
  common: '#6B7280',
  uncommon: '#22C55E',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
  mythic: '#EC4899',
};
import { SPECIES_EXAMPLE_IMAGES } from '@/src/constants/speciesExampleImages';
import { getUserCatches } from '@/src/lib/supabase';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { isValidImageUri } from '@/src/lib/imageUri';
import Feather from '@expo/vector-icons/Feather';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { FishIcon } from '@/src/components/passport/FishIcon';

/** Redfish (red-drum) custom assets: grey = locked, color = unlocked */
const REDFISH_LOCKED = require('../../assets/passport-redfish/1.png');
const REDFISH_UNLOCKED = require('../../assets/passport-redfish/2.png');
const REDFISH_SPECIES_ID = 'red-drum';

/** Tarpon custom assets: grey = locked (5.png), color = unlocked (4.png) */
const TARPON_LOCKED = require('../../assets/passport-tarpon/5.png');
const TARPON_UNLOCKED = require('../../assets/passport-tarpon/4.png');
const TARPON_SPECIES_ID = 'tarpon';

/** Snook custom assets: grey = locked, color = unlocked */
const SNOOK_LOCKED = require('../../assets/passport-snook/7.png');
const SNOOK_UNLOCKED = require('../../assets/passport-snook/6.png');
const SNOOK_SPECIES_ID = 'snook';

/** Spotted seatrout custom assets: grey = locked, color = unlocked */
const SEATROUT_LOCKED = require('../../assets/passport-seatrout/9.png');
const SEATROUT_UNLOCKED = require('../../assets/passport-seatrout/8.png');
const SEATROUT_SPECIES_ID = 'spotted-seatrout';

/** Flounder custom assets: grey = locked, color = unlocked */
const FLOUNDER_LOCKED = require('../../assets/passport-flounder/11.png');
const FLOUNDER_UNLOCKED = require('../../assets/passport-flounder/10.png');
const FLOUNDER_SPECIES_ID = 'flounder';

/** Sheepshead custom assets: grey = locked, color = unlocked */
const SHEEPSHEAD_LOCKED = require('../../assets/passport-sheepshead/13.png');
const SHEEPSHEAD_UNLOCKED = require('../../assets/passport-sheepshead/12.png');
const SHEEPSHEAD_SPECIES_ID = 'sheepshead';

/** Black drum custom assets: grey = locked, color = unlocked */
const BLACKDRUM_LOCKED = require('../../assets/passport-blackdrum/15.png');
const BLACKDRUM_UNLOCKED = require('../../assets/passport-blackdrum/14.png');
const BLACKDRUM_SPECIES_ID = 'black-drum';

/** Spanish mackerel custom assets: grey = locked, color = unlocked */
const SPANISHMACKEREL_LOCKED = require('../../assets/passport-spanish-mackerel/17.png');
const SPANISHMACKEREL_UNLOCKED = require('../../assets/passport-spanish-mackerel/16.png');
const SPANISHMACKEREL_SPECIES_ID = 'spanish-mackerel';

/** King mackerel custom assets: grey = locked, color = unlocked */
const KINGMACKEREL_LOCKED = require('../../assets/passport-king-mackerel/19.png');
const KINGMACKEREL_UNLOCKED = require('../../assets/passport-king-mackerel/18.png');
const KINGMACKEREL_SPECIES_ID = 'king-mackerel';

/** Pompano custom assets: grey = locked, color = unlocked */
const POMPANO_LOCKED = require('../../assets/passport-pompano/21.png');
const POMPANO_UNLOCKED = require('../../assets/passport-pompano/20.png');
const POMPANO_SPECIES_ID = 'pompano';

/** Jack crevalle custom assets: grey = locked, color = unlocked */
const JACKCREVALLE_LOCKED = require('../../assets/passport-jack-crevalle/23.png');
const JACKCREVALLE_UNLOCKED = require('../../assets/passport-jack-crevalle/22.png');
const JACKCREVALLE_SPECIES_ID = 'jack-crevalle';

/** Ladyfish custom assets: grey = locked, color = unlocked */
const LADYFISH_LOCKED = require('../../assets/passport-ladyfish/25.png');
const LADYFISH_UNLOCKED = require('../../assets/passport-ladyfish/24.png');
const LADYFISH_SPECIES_ID = 'ladyfish';

/** Largemouth bass custom assets: grey = locked, color = unlocked */
const LARGEMOUTHBASS_LOCKED = require('../../assets/passport-largemouth-bass/27.png');
const LARGEMOUTHBASS_UNLOCKED = require('../../assets/passport-largemouth-bass/26.png');
const LARGEMOUTHBASS_SPECIES_ID = 'largemouth-bass';

/** Smallmouth bass custom assets: grey = locked, color = unlocked */
const SMALLMOUTHBASS_LOCKED = require('../../assets/passport-smallmouth-bass/29.png');
const SMALLMOUTHBASS_UNLOCKED = require('../../assets/passport-smallmouth-bass/28.png');
const SMALLMOUTHBASS_SPECIES_ID = 'smallmouth-bass';

/** Spotted bass custom assets: grey = locked, color = unlocked */
const SPOTTEDBASS_LOCKED = require('../../assets/passport-spotted-bass/101.png');
const SPOTTEDBASS_UNLOCKED = require('../../assets/passport-spotted-bass/100.png');
const SPOTTEDBASS_SPECIES_ID = 'spotted-bass';

/** Black crappie custom assets: grey = locked, color = unlocked */
const BLACKCRAPPIE_LOCKED = require('../../assets/passport-black-crappie/31.png');
const BLACKCRAPPIE_UNLOCKED = require('../../assets/passport-black-crappie/30.png');
const BLACKCRAPPIE_SPECIES_ID = 'crappie-black';

/** White crappie custom assets: grey = locked, color = unlocked */
const WHITECRAPPIE_LOCKED = require('../../assets/passport-white-crappie/103.png');
const WHITECRAPPIE_UNLOCKED = require('../../assets/passport-white-crappie/102.png');
const WHITECRAPPIE_SPECIES_ID = 'crappie-white';

/** Bluegill custom assets: grey = locked, color = unlocked */
const BLUEGILL_LOCKED = require('../../assets/passport-bluegill/33.png');
const BLUEGILL_UNLOCKED = require('../../assets/passport-bluegill/32.png');
const BLUEGILL_SPECIES_ID = 'bluegill';

/** Channel catfish custom assets: grey = locked, color = unlocked */
const CHANNELCATFISH_LOCKED = require('../../assets/passport-channel-catfish/105.png');
const CHANNELCATFISH_UNLOCKED = require('../../assets/passport-channel-catfish/104.png');
const CHANNELCATFISH_SPECIES_ID = 'channel-catfish';

/** Flathead catfish custom assets: grey = locked, color = unlocked */
const FLATHEADCATFISH_LOCKED = require('../../assets/passport-flathead-catfish/107.png');
const FLATHEADCATFISH_UNLOCKED = require('../../assets/passport-flathead-catfish/106.png');
const FLATHEADCATFISH_SPECIES_ID = 'flathead-catfish';

/** Blue catfish custom assets: grey = locked, color = unlocked */
const BLUECATFISH_LOCKED = require('../../assets/passport-blue-catfish/109.png');
const BLUECATFISH_UNLOCKED = require('../../assets/passport-blue-catfish/108.png');
const BLUECATFISH_SPECIES_ID = 'blue-catfish';

/** Walleye custom assets: grey = locked, color = unlocked */
const WALLEYE_LOCKED = require('../../assets/passport-walleye/111.png');
const WALLEYE_UNLOCKED = require('../../assets/passport-walleye/110.png');
const WALLEYE_SPECIES_ID = 'walleye';

/** Northern pike custom assets: grey = locked, color = unlocked */
const NORTHERNPIKE_LOCKED = require('../../assets/passport-northern-pike/113.png');
const NORTHERNPIKE_UNLOCKED = require('../../assets/passport-northern-pike/112.png');
const NORTHERNPIKE_SPECIES_ID = 'northern-pike';

/** Rainbow trout custom assets: grey = locked, color = unlocked */
const RAINBOWTROUT_LOCKED = require('../../assets/passport-rainbow-trout/115.png');
const RAINBOWTROUT_UNLOCKED = require('../../assets/passport-rainbow-trout/114.png');
const RAINBOWTROUT_SPECIES_ID = 'rainbow-trout';

/** Brown trout custom assets: grey = locked, color = unlocked */
const BROWNTROUT_LOCKED = require('../../assets/passport-brown-trout/117.png');
const BROWNTROUT_UNLOCKED = require('../../assets/passport-brown-trout/116.png');
const BROWNTROUT_SPECIES_ID = 'brown-trout';

/** Brook trout custom assets: grey = locked, color = unlocked */
const BROOKTROUT_LOCKED = require('../../assets/passport-brook-trout/119.png');
const BROOKTROUT_UNLOCKED = require('../../assets/passport-brook-trout/118.png');
const BROOKTROUT_SPECIES_ID = 'brook-trout';

/** Muskie custom assets: grey = locked, color = unlocked */
const MUSKIE_LOCKED = require('../../assets/passport-muskie/121.png');
const MUSKIE_UNLOCKED = require('../../assets/passport-muskie/120.png');
const MUSKIE_SPECIES_ID = 'muskie';

/** Carp custom assets: grey = locked, color = unlocked */
const CARP_LOCKED = require('../../assets/passport-carp/123.png');
const CARP_UNLOCKED = require('../../assets/passport-carp/122.png');
const CARP_SPECIES_ID = 'carp';

/** White bass custom assets: grey = locked, color = unlocked */
const WHITEBASS_LOCKED = require('../../assets/passport-white-bass/125.png');
const WHITEBASS_UNLOCKED = require('../../assets/passport-white-bass/124.png');
const WHITEBASS_SPECIES_ID = 'white-bass';

/** Yellow perch custom assets: grey = locked, color = unlocked */
const YELLOWPERCH_LOCKED = require('../../assets/passport-yellow-perch/127.png');
const YELLOWPERCH_UNLOCKED = require('../../assets/passport-yellow-perch/126.png');
const YELLOWPERCH_SPECIES_ID = 'yellow-perch';

/** Drum (freshwater) custom assets: grey = locked, color = unlocked */
const DRUMFRESHWATER_LOCKED = require('../../assets/passport-freshwater-drum/129.png');
const DRUMFRESHWATER_UNLOCKED = require('../../assets/passport-freshwater-drum/128.png');
const DRUMFRESHWATER_SPECIES_ID = 'drum-freshwater';

/** Gar custom assets: grey = locked, color = unlocked */
const GAR_LOCKED = require('../../assets/passport-gar/131.png');
const GAR_UNLOCKED = require('../../assets/passport-gar/130.png');
const GAR_SPECIES_ID = 'gar';

/** Stingray custom assets: grey = locked, color = unlocked */
const STINGRAY_LOCKED = require('../../assets/passport-stingray/133.png');
const STINGRAY_UNLOCKED = require('../../assets/passport-stingray/132.png');
const STINGRAY_SPECIES_ID = 'stingray';

/** Pinfish custom assets: grey = locked, color = unlocked */
const PINFISH_LOCKED = require('../../assets/passport-pinfish/135.png');
const PINFISH_UNLOCKED = require('../../assets/passport-pinfish/134.png');
const PINFISH_SPECIES_ID = 'pinfish';

/** Pigfish custom assets: grey = locked, color = unlocked */
const PIGFISH_LOCKED = require('../../assets/passport-pigfish/137.png');
const PIGFISH_UNLOCKED = require('../../assets/passport-pigfish/136.png');
const PIGFISH_SPECIES_ID = 'pigfish';

/** Pufferfish custom assets: grey = locked, color = unlocked */
const PUFFERFISH_LOCKED = require('../../assets/passport-pufferfish/139.png');
const PUFFERFISH_UNLOCKED = require('../../assets/passport-pufferfish/138.png');
const PUFFERFISH_SPECIES_ID = 'pufferfish';

/** Wahoo custom assets: grey = locked, color = unlocked */
const WAHOO_LOCKED = require('../../assets/passport-wahoo/141.png');
const WAHOO_UNLOCKED = require('../../assets/passport-wahoo/140.png');
const WAHOO_SPECIES_ID = 'wahoo';

/** Yellowfin tuna custom assets: grey = locked, color = unlocked */
const YELLOWFINTUNA_LOCKED = require('../../assets/passport-yellowfin-tuna/143.png');
const YELLOWFINTUNA_UNLOCKED = require('../../assets/passport-yellowfin-tuna/142.png');
const YELLOWFINTUNA_SPECIES_ID = 'yellowfin-tuna';

/** Bluefin tuna custom assets: grey = locked, color = unlocked */
const BLUEFINTUNA_LOCKED = require('../../assets/passport-bluefin-tuna/145.png');
const BLUEFINTUNA_UNLOCKED = require('../../assets/passport-bluefin-tuna/144.png');
const BLUEFINTUNA_SPECIES_ID = 'bluefin-tuna';

/** Kingfish custom assets: grey = locked, color = unlocked */
const KINGFISH_LOCKED = require('../../assets/passport-kingfish/147.png');
const KINGFISH_UNLOCKED = require('../../assets/passport-kingfish/146.png');
const KINGFISH_SPECIES_ID = 'kingfish';

/** Sailfish custom assets: grey = locked, color = unlocked */
const SAILFISH_LOCKED = require('../../assets/passport-sailfish/149.png');
const SAILFISH_UNLOCKED = require('../../assets/passport-sailfish/148.png');
const SAILFISH_SPECIES_ID = 'sailfish';

/** White marlin custom assets: grey = locked, color = unlocked */
const WHITEMARLIN_LOCKED = require('../../assets/passport-white-marlin/151.png');
const WHITEMARLIN_UNLOCKED = require('../../assets/passport-white-marlin/150.png');
const WHITEMARLIN_SPECIES_ID = 'white-marlin';

/** Bluefish custom assets: grey = locked, color = unlocked */
const BLUEFISH_LOCKED = require('../../assets/passport-bluefish/37.png');
const BLUEFISH_UNLOCKED = require('../../assets/passport-bluefish/36.png');
const BLUEFISH_SPECIES_ID = 'bluefish';

/** Mahi mahi custom assets: grey = locked, color = unlocked */
const MAHIMAHI_LOCKED = require('../../assets/passport-mahi-mahi/39.png');
const MAHIMAHI_UNLOCKED = require('../../assets/passport-mahi-mahi/38.png');
const MAHIMAHI_SPECIES_ID = 'mahi-mahi';

/** Cobia custom assets: grey = locked, color = unlocked */
const COBIA_LOCKED = require('../../assets/passport-cobia/41.png');
const COBIA_UNLOCKED = require('../../assets/passport-cobia/40.png');
const COBIA_SPECIES_ID = 'cobia';

/** Red snapper custom assets: grey = locked, color = unlocked */
const REDSNAPPER_LOCKED = require('../../assets/passport-red-snapper/43.png');
const REDSNAPPER_UNLOCKED = require('../../assets/passport-red-snapper/42.png');
const REDSNAPPER_SPECIES_ID = 'red-snapper';

/** Mangrove snapper custom assets: grey = locked, color = unlocked */
const MANGROVESNAPPER_LOCKED = require('../../assets/passport-mangrove-snapper/45.png');
const MANGROVESNAPPER_UNLOCKED = require('../../assets/passport-mangrove-snapper/44.png');
const MANGROVESNAPPER_SPECIES_ID = 'mangrove-snapper';

/** Yellowtail snapper custom assets: grey = locked, color = unlocked */
const YELLOWTAILSNAPPER_LOCKED = require('../../assets/passport-yellowtail-snapper/47.png');
const YELLOWTAILSNAPPER_UNLOCKED = require('../../assets/passport-yellowtail-snapper/46.png');
const YELLOWTAILSNAPPER_SPECIES_ID = 'yellowtail-snapper';

/** Amberjack custom assets: grey = locked, color = unlocked */
const AMBERJACK_LOCKED = require('../../assets/passport-amberjack/49.png');
const AMBERJACK_UNLOCKED = require('../../assets/passport-amberjack/48.png');
const AMBERJACK_SPECIES_ID = 'amberjack';

/** Grouper custom assets: grey = locked, color = unlocked */
const GROUPER_LOCKED = require('../../assets/passport-grouper/51.png');
const GROUPER_UNLOCKED = require('../../assets/passport-grouper/50.png');
const GROUPER_SPECIES_ID = 'grouper';

/** Striped bass custom assets: grey = locked, color = unlocked */
const STRIPEDBASS_LOCKED = require('../../assets/passport-striped-bass/53.png');
const STRIPEDBASS_UNLOCKED = require('../../assets/passport-striped-bass/52.png');
const STRIPEDBASS_SPECIES_ID = 'striped-bass';

/** Weakfish custom assets: grey = locked, color = unlocked */
const WEAKFISH_LOCKED = require('../../assets/passport-weakfish/55.png');
const WEAKFISH_UNLOCKED = require('../../assets/passport-weakfish/54.png');
const WEAKFISH_SPECIES_ID = 'weakfish';

/** Barracuda custom assets: grey = locked, color = unlocked */
const BARRACUDA_LOCKED = require('../../assets/passport-barracuda/57.png');
const BARRACUDA_UNLOCKED = require('../../assets/passport-barracuda/56.png');
const BARRACUDA_SPECIES_ID = 'barracuda';

/** Triggerfish custom assets: grey = locked, color = unlocked */
const TRIGGERFISH_LOCKED = require('../../assets/passport-triggerfish/59.png');
const TRIGGERFISH_UNLOCKED = require('../../assets/passport-triggerfish/58.png');
const TRIGGERFISH_SPECIES_ID = 'triggerfish';

/** Sea bass custom assets: grey = locked, color = unlocked */
const SEABASS_LOCKED = require('../../assets/passport-sea-bass/61.png');
const SEABASS_UNLOCKED = require('../../assets/passport-sea-bass/60.png');
const SEABASS_SPECIES_ID = 'sea-bass';

/** Porgy custom assets: grey = locked, color = unlocked */
const PORGY_LOCKED = require('../../assets/passport-porgy/63.png');
const PORGY_UNLOCKED = require('../../assets/passport-porgy/62.png');
const PORGY_SPECIES_ID = 'porgy';

/** Hogfish custom assets: grey = locked, color = unlocked */
const HOGFISH_LOCKED = require('../../assets/passport-hogfish/65.png');
const HOGFISH_UNLOCKED = require('../../assets/passport-hogfish/64.png');
const HOGFISH_SPECIES_ID = 'hogfish';

/** Tripletail custom assets: grey = locked, color = unlocked */
const TRIPLETAIL_LOCKED = require('../../assets/passport-tripletail/67.png');
const TRIPLETAIL_UNLOCKED = require('../../assets/passport-tripletail/66.png');
const TRIPLETAIL_SPECIES_ID = 'tripletail';

/** Bonefish custom assets: grey = locked, color = unlocked */
const BONEFISH_LOCKED = require('../../assets/passport-bonefish/69.png');
const BONEFISH_UNLOCKED = require('../../assets/passport-bonefish/68.png');
const BONEFISH_SPECIES_ID = 'bonefish';

/** Permit custom assets: grey = locked, color = unlocked */
const PERMIT_LOCKED = require('../../assets/passport-permit/71.png');
const PERMIT_UNLOCKED = require('../../assets/passport-permit/70.png');
const PERMIT_SPECIES_ID = 'permit';

/** Bonito custom assets: grey = locked, color = unlocked */
const BONITO_LOCKED = require('../../assets/passport-bonito/73.png');
const BONITO_UNLOCKED = require('../../assets/passport-bonito/72.png');
const BONITO_SPECIES_ID = 'bonito';

/** Croaker custom assets: grey = locked, color = unlocked */
const CROAKER_LOCKED = require('../../assets/passport-croaker/75.png');
const CROAKER_UNLOCKED = require('../../assets/passport-croaker/74.png');
const CROAKER_SPECIES_ID = 'croaker';

/** Toadfish custom assets: grey = locked, color = unlocked */
const TOADFISH_LOCKED = require('../../assets/passport-toadfish/77.png');
const TOADFISH_UNLOCKED = require('../../assets/passport-toadfish/76.png');
const TOADFISH_SPECIES_ID = 'toadfish';

/** Whiting custom assets: grey = locked, color = unlocked */
const WHITING_LOCKED = require('../../assets/passport-whiting/78.png');
const WHITING_UNLOCKED = require('../../assets/passport-whiting/79.png');
const WHITING_SPECIES_ID = 'whiting';

/** Sandbar shark custom assets: grey = locked, color = unlocked */
const SANDBARSHARK_LOCKED = require('../../assets/passport-sandbar-shark/81.png');
const SANDBARSHARK_UNLOCKED = require('../../assets/passport-sandbar-shark/80.png');
const SANDBARSHARK_SPECIES_ID = 'sandbar-shark';

/** Blacktip shark custom assets: grey = locked, color = unlocked */
const BLACKTIPSHARK_LOCKED = require('../../assets/passport-blacktip-shark/83.png');
const BLACKTIPSHARK_UNLOCKED = require('../../assets/passport-blacktip-shark/82.png');
const BLACKTIPSHARK_SPECIES_ID = 'blacktip-shark';

/** Spinner shark custom assets: grey = locked, color = unlocked */
const SPINNERSHARK_LOCKED = require('../../assets/passport-spinner-shark/85.png');
const SPINNERSHARK_UNLOCKED = require('../../assets/passport-spinner-shark/84.png');
const SPINNERSHARK_SPECIES_ID = 'spinner-shark';

/** Sharpnose shark custom assets: grey = locked, color = unlocked */
const SHARPNOSESHARK_LOCKED = require('../../assets/passport-sharpnose-shark/85.png');
const SHARPNOSESHARK_UNLOCKED = require('../../assets/passport-sharpnose-shark/84.png');
const SHARPNOSESHARK_SPECIES_ID = 'sharpnose-shark';

/** Bonnethead shark custom assets: grey = locked, color = unlocked */
const BONNETHEADSHARK_LOCKED = require('../../assets/passport-bonnethead-shark/89.png');
const BONNETHEADSHARK_UNLOCKED = require('../../assets/passport-bonnethead-shark/88.png');
const BONNETHEADSHARK_SPECIES_ID = 'bonnethead-shark';

/** Hammerhead shark custom assets: grey = locked, color = unlocked */
const HAMMERHEADSHARK_LOCKED = require('../../assets/passport-hammerhead-shark/91.png');
const HAMMERHEADSHARK_UNLOCKED = require('../../assets/passport-hammerhead-shark/90.png');
const HAMMERHEADSHARK_SPECIES_ID = 'hammerhead-shark';

/** Mako shark custom assets: grey = locked, color = unlocked */
const MAKOSHARK_LOCKED = require('../../assets/passport-mako-shark/87.png');
const MAKOSHARK_UNLOCKED = require('../../assets/passport-mako-shark/86.png');
const MAKOSHARK_SPECIES_ID = 'mako-shark';

/** Bull shark custom assets: grey = locked, color = unlocked */
const BULLSHARK_LOCKED = require('../../assets/passport-bull-shark/95.png');
const BULLSHARK_UNLOCKED = require('../../assets/passport-bull-shark/94.png');
const BULLSHARK_SPECIES_ID = 'bull-shark';

/** Tiger shark custom assets: grey = locked, color = unlocked */
const TIGERSHARK_LOCKED = require('../../assets/passport-tiger-shark/97.png');
const TIGERSHARK_UNLOCKED = require('../../assets/passport-tiger-shark/96.png');
const TIGERSHARK_SPECIES_ID = 'tiger-shark';

/** Thresher shark custom assets: grey = locked, color = unlocked */
const THRESHERSHARK_LOCKED = require('../../assets/passport-thresher-shark/99.png');
const THRESHERSHARK_UNLOCKED = require('../../assets/passport-thresher-shark/98.png');
const THRESHERSHARK_SPECIES_ID = 'thresher-shark';

/** Atlantic sturgeon custom assets: grey = locked (169), color = unlocked (168) */
const ATLANTICSTURGEON_LOCKED = require('../../assets/passport-atlantic-sturgeon/169.png');
const ATLANTICSTURGEON_UNLOCKED = require('../../assets/passport-atlantic-sturgeon/168.png');
const ATLANTICSTURGEON_SPECIES_ID = 'atlantic-sturgeon';

/** Steelhead custom assets: grey = locked (171), color = unlocked (170) */
const STEELHEAD_LOCKED = require('../../assets/passport-steelhead/171.png');
const STEELHEAD_UNLOCKED = require('../../assets/passport-steelhead/170.png');
const STEELHEAD_SPECIES_ID = 'steelhead';

/** White sturgeon custom assets: grey = locked (167), color = unlocked (166) */
const WHITESTURGEON_LOCKED = require('../../assets/passport-white-sturgeon/167.png');
const WHITESTURGEON_UNLOCKED = require('../../assets/passport-white-sturgeon/166.png');
const WHITESTURGEON_SPECIES_ID = 'white-sturgeon';

/** Bowfin custom assets: grey = locked (175), color = unlocked (174) */
const BOWFIN_LOCKED = require('../../assets/passport-bowfin/175.png');
const BOWFIN_UNLOCKED = require('../../assets/passport-bowfin/174.png');
const BOWFIN_SPECIES_ID = 'bowfin';

/** Peacock bass custom assets: grey = locked (163), color = unlocked (162) */
const PEACOCKBASS_LOCKED = require('../../assets/passport-peacock-bass/163.png');
const PEACOCKBASS_UNLOCKED = require('../../assets/passport-peacock-bass/162.png');
const PEACOCKBASS_SPECIES_ID = 'peacock-bass';

/** Warmouth custom assets: grey = locked (101), color = unlocked (100) */
const WARMOUTH_LOCKED = require('../../assets/passport-warmouth/101.png');
const WARMOUTH_UNLOCKED = require('../../assets/passport-warmouth/100.png');
const WARMOUTH_SPECIES_ID = 'warmouth';

/** Pickerel custom assets: grey = locked (101), color = unlocked (100) */
const PICKEREL_LOCKED = require('../../assets/passport-pickerel/159.png');
const PICKEREL_UNLOCKED = require('../../assets/passport-pickerel/158.png');
const PICKEREL_SPECIES_ID = 'pickerel';

/** White perch custom assets: grey = locked (101), color = unlocked (100) */
const WHITEPERCH_LOCKED = require('../../assets/passport-white-perch/157.png');
const WHITEPERCH_UNLOCKED = require('../../assets/passport-white-perch/156.png');
const WHITEPERCH_SPECIES_ID = 'white-perch';

/** Threadfin shad custom assets: grey = locked (101), color = unlocked (100) */
const THREADFINSHAD_LOCKED = require('../../assets/passport-threadfin-shad/155.png');
const THREADFINSHAD_UNLOCKED = require('../../assets/passport-threadfin-shad/154.png');
const THREADFINSHAD_SPECIES_ID = 'threadfin-shad';

/** American shad custom assets: grey = locked (101), color = unlocked (100) */
const AMERICANSHAD_LOCKED = require('../../assets/passport-american-shad/101.png');
const AMERICANSHAD_UNLOCKED = require('../../assets/passport-american-shad/100.png');
const AMERICANSHAD_SPECIES_ID = 'american-shad';

/** Tilapia custom assets: grey = locked (173), color = unlocked (172) */
const TILAPIA_LOCKED = require('../../assets/passport-tilapia/173.png');
const TILAPIA_UNLOCKED = require('../../assets/passport-tilapia/172.png');
const TILAPIA_SPECIES_ID = 'tilapia';

/** Snakehead custom assets: grey = locked (165), color = unlocked (164) */
const SNAKEHEAD_LOCKED = require('../../assets/passport-snakehead/165.png');
const SNAKEHEAD_UNLOCKED = require('../../assets/passport-snakehead/164.png');
const SNAKEHEAD_SPECIES_ID = 'snakehead';

const ACCENT_BLUE = colors.brightBlue;
/** Light grey for uncaught fish — same shape as real fish, replica silhouette */
const LOCKED_FISH_GREY = '#A8A8A8';
const { width } = Dimensions.get('window');
const PADDING = 16;
const GAP = 10;
const CARD_WIDTH = (width - PADDING * 2 - GAP * 2) / 3;

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  android: { elevation: 4 },
});

/** All stamps use the same icon size so cards are uniform */
const STAMP_ICON_SIZE = 95;

function formatCatchDate(takenAt: string | undefined): string | null {
  if (!takenAt || typeof takenAt !== 'string') return null;
  const d = new Date(takenAt.includes('T') ? takenAt : takenAt + 'Z');
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SpeciesStamp({
  species,
  caught,
  count,
  justStamped,
  onPress,
}: {
  species: { id: string; name: string; rarity: SpeciesRarity };
  caught: boolean;
  count: number;
  justStamped?: boolean;
  onPress?: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [species.id, caught]);

  useEffect(() => {
    if (justStamped && caught) {
      scaleAnim.setValue(0.5);
      glowAnim.setValue(1);
      Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
          tension: 120,
          friction: 7,
        useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [justStamped, caught, scaleAnim, glowAnim]);

  const speciesImageUri = SPECIES_EXAMPLE_IMAGES[species.id];
  const showCaughtImage = caught && speciesImageUri && !imageError;
  const isRedfish = species.id === REDFISH_SPECIES_ID;
  const isTarpon = species.id === TARPON_SPECIES_ID;
  const isSnook = species.id === SNOOK_SPECIES_ID;
  const isSeatrout = species.id === SEATROUT_SPECIES_ID;
  const isFlounder = species.id === FLOUNDER_SPECIES_ID;
  const isSheepshead = species.id === SHEEPSHEAD_SPECIES_ID;
  const isBlackDrum = species.id === BLACKDRUM_SPECIES_ID;
  const isSpanishMackerel = species.id === SPANISHMACKEREL_SPECIES_ID;
  const isKingMackerel = species.id === KINGMACKEREL_SPECIES_ID;
  const isPompano = species.id === POMPANO_SPECIES_ID;
  const isJackCrevalle = species.id === JACKCREVALLE_SPECIES_ID;
  const isLadyfish = species.id === LADYFISH_SPECIES_ID;
  const isLargemouthBass = species.id === LARGEMOUTHBASS_SPECIES_ID;
  const isSmallmouthBass = species.id === SMALLMOUTHBASS_SPECIES_ID;
  const isSpottedBass = species.id === SPOTTEDBASS_SPECIES_ID;
  const isBlackCrappie = species.id === BLACKCRAPPIE_SPECIES_ID;
  const isWhiteCrappie = species.id === WHITECRAPPIE_SPECIES_ID;
  const isBluegill = species.id === BLUEGILL_SPECIES_ID;
  const isChannelCatfish = species.id === CHANNELCATFISH_SPECIES_ID;
  const isFlatheadCatfish = species.id === FLATHEADCATFISH_SPECIES_ID;
  const isBlueCatfish = species.id === BLUECATFISH_SPECIES_ID;
  const isWalleye = species.id === WALLEYE_SPECIES_ID;
  const isNorthernPike = species.id === NORTHERNPIKE_SPECIES_ID;
  const isRainbowTrout = species.id === RAINBOWTROUT_SPECIES_ID;
  const isBrownTrout = species.id === BROWNTROUT_SPECIES_ID;
  const isBrookTrout = species.id === BROOKTROUT_SPECIES_ID;
  const isMuskie = species.id === MUSKIE_SPECIES_ID;
  const isCarp = species.id === CARP_SPECIES_ID;
  const isWhiteBass = species.id === WHITEBASS_SPECIES_ID;
  const isYellowPerch = species.id === YELLOWPERCH_SPECIES_ID;
  const isDrumFreshwater = species.id === DRUMFRESHWATER_SPECIES_ID;
  const isGar = species.id === GAR_SPECIES_ID;
  const isStingray = species.id === STINGRAY_SPECIES_ID;
  const isPinfish = species.id === PINFISH_SPECIES_ID;
  const isPigfish = species.id === PIGFISH_SPECIES_ID;
  const isPufferfish = species.id === PUFFERFISH_SPECIES_ID;
  const isWahoo = species.id === WAHOO_SPECIES_ID;
  const isYellowfinTuna = species.id === YELLOWFINTUNA_SPECIES_ID;
  const isBluefinTuna = species.id === BLUEFINTUNA_SPECIES_ID;
  const isKingfish = species.id === KINGFISH_SPECIES_ID;
  const isSailfish = species.id === SAILFISH_SPECIES_ID;
  const isWhiteMarlin = species.id === WHITEMARLIN_SPECIES_ID;
  const isBluefish = species.id === BLUEFISH_SPECIES_ID;
  const isMahiMahi = species.id === MAHIMAHI_SPECIES_ID;
  const isCobia = species.id === COBIA_SPECIES_ID;
  const isRedSnapper = species.id === REDSNAPPER_SPECIES_ID;
  const isMangroveSnapper = species.id === MANGROVESNAPPER_SPECIES_ID;
  const isYellowtailSnapper = species.id === YELLOWTAILSNAPPER_SPECIES_ID;
  const isAmberjack = species.id === AMBERJACK_SPECIES_ID;
  const isGrouper = species.id === GROUPER_SPECIES_ID;
  const isStripedBass = species.id === STRIPEDBASS_SPECIES_ID;
  const isWeakfish = species.id === WEAKFISH_SPECIES_ID;
  const isBarracuda = species.id === BARRACUDA_SPECIES_ID;
  const isTriggerfish = species.id === TRIGGERFISH_SPECIES_ID;
  const isSeaBass = species.id === SEABASS_SPECIES_ID;
  const isPorgy = species.id === PORGY_SPECIES_ID;
  const isHogfish = species.id === HOGFISH_SPECIES_ID;
  const isTripletail = species.id === TRIPLETAIL_SPECIES_ID;
  const isBonefish = species.id === BONEFISH_SPECIES_ID;
  const isPermit = species.id === PERMIT_SPECIES_ID;
  const isBonito = species.id === BONITO_SPECIES_ID;
  const isCroaker = species.id === CROAKER_SPECIES_ID;
  const isToadfish = species.id === TOADFISH_SPECIES_ID;
  const isWhiting = species.id === WHITING_SPECIES_ID;
  const isSandbarShark = species.id === SANDBARSHARK_SPECIES_ID;
  const isBlacktipShark = species.id === BLACKTIPSHARK_SPECIES_ID;
  const isSpinnerShark = species.id === SPINNERSHARK_SPECIES_ID;
  const isSharpnoseShark = species.id === SHARPNOSESHARK_SPECIES_ID;
  const isBonnetheadShark = species.id === BONNETHEADSHARK_SPECIES_ID;
  const isHammerheadShark = species.id === HAMMERHEADSHARK_SPECIES_ID;
  const isMakoShark = species.id === MAKOSHARK_SPECIES_ID;
  const isBullShark = species.id === BULLSHARK_SPECIES_ID;
  const isTigerShark = species.id === TIGERSHARK_SPECIES_ID;
  const isThresherShark = species.id === THRESHERSHARK_SPECIES_ID;
  const isAtlanticSturgeon = species.id === ATLANTICSTURGEON_SPECIES_ID;
  const isSteelhead = species.id === STEELHEAD_SPECIES_ID;
  const isWhiteSturgeon = species.id === WHITESTURGEON_SPECIES_ID;
  const isBowfin = species.id === BOWFIN_SPECIES_ID;
  const isPeacockBass = species.id === PEACOCKBASS_SPECIES_ID;
  const isWarmouth = species.id === WARMOUTH_SPECIES_ID;
  const isPickerel = species.id === PICKEREL_SPECIES_ID;
  const isWhitePerch = species.id === WHITEPERCH_SPECIES_ID;
  const isThreadfinShad = species.id === THREADFINSHAD_SPECIES_ID;
  const isAmericanShad = species.id === AMERICANSHAD_SPECIES_ID;
  const isTilapia = species.id === TILAPIA_SPECIES_ID;
  const isSnakehead = species.id === SNAKEHEAD_SPECIES_ID;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.stampTouchable}
    >
    <Animated.View
      style={[
        styles.stamp,
        caught ? styles.stampCaught : styles.stampLocked,
        cardShadow,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* All stamps use same-size icon area. Redfish/Tarpon/Snook/Seatrout/Flounder/Sheepshead/BlackDrum/SpanishMackerel/KingMackerel/Pompano/JackCrevalle/Ladyfish/LargemouthBass/SmallmouthBass/SpottedBass/BlackCrappie/WhiteCrappie/Bluegill/ChannelCatfish/FlatheadCatfish/BlueCatfish/Walleye/NorthernPike/RainbowTrout/BrownTrout/BrookTrout/Muskie/Carp/WhiteBass/YellowPerch/DrumFreshwater/Gar/Stingray/Pinfish/Pigfish/Pufferfish/Wahoo/YellowfinTuna/BluefinTuna/Kingfish/Sailfish/WhiteMarlin/Bluefish/MahiMahi/Cobia/RedSnapper/MangroveSnapper/YellowtailSnapper/Amberjack/Grouper/StripedBass/Weakfish/Barracuda/Triggerfish/SeaBass/Porgy/Hogfish/Tripletail/Bonefish/Permit/Bonito/Croaker/Toadfish/Whiting/SandbarShark/BlacktipShark/SpinnerShark/SharpnoseShark/BonnetheadShark/HammerheadShark/MakoShark/BullShark/TigerShark/ThresherShark: custom assets; others: FishIcon or species photo. */}
      <View style={styles.stampIconWrap}>
        {isRedfish ? (
          <Image
            source={caught ? REDFISH_UNLOCKED : REDFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isTarpon ? (
          <Image
            source={caught ? TARPON_UNLOCKED : TARPON_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSnook ? (
          <Image
            source={caught ? SNOOK_UNLOCKED : SNOOK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSeatrout ? (
          <Image
            source={caught ? SEATROUT_UNLOCKED : SEATROUT_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isFlounder ? (
          <Image
            source={caught ? FLOUNDER_UNLOCKED : FLOUNDER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSheepshead ? (
          <Image
            source={caught ? SHEEPSHEAD_UNLOCKED : SHEEPSHEAD_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBlackDrum ? (
          <Image
            source={caught ? BLACKDRUM_UNLOCKED : BLACKDRUM_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSpanishMackerel ? (
          <Image
            source={caught ? SPANISHMACKEREL_UNLOCKED : SPANISHMACKEREL_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isKingMackerel ? (
          <Image
            source={caught ? KINGMACKEREL_UNLOCKED : KINGMACKEREL_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPompano ? (
          <Image
            source={caught ? POMPANO_UNLOCKED : POMPANO_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isJackCrevalle ? (
          <Image
            source={caught ? JACKCREVALLE_UNLOCKED : JACKCREVALLE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isLadyfish ? (
          <Image
            source={caught ? LADYFISH_UNLOCKED : LADYFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isLargemouthBass ? (
          <Image
            source={caught ? LARGEMOUTHBASS_UNLOCKED : LARGEMOUTHBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSmallmouthBass ? (
          <Image
            source={caught ? SMALLMOUTHBASS_UNLOCKED : SMALLMOUTHBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSpottedBass ? (
          <Image
            source={caught ? SPOTTEDBASS_UNLOCKED : SPOTTEDBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBlackCrappie ? (
          <Image
            source={caught ? BLACKCRAPPIE_UNLOCKED : BLACKCRAPPIE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhiteCrappie ? (
          <Image
            source={caught ? WHITECRAPPIE_UNLOCKED : WHITECRAPPIE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBluegill ? (
          <Image
            source={caught ? BLUEGILL_UNLOCKED : BLUEGILL_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isChannelCatfish ? (
          <Image
            source={caught ? CHANNELCATFISH_UNLOCKED : CHANNELCATFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isFlatheadCatfish ? (
          <Image
            source={caught ? FLATHEADCATFISH_UNLOCKED : FLATHEADCATFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBlueCatfish ? (
          <Image
            source={caught ? BLUECATFISH_UNLOCKED : BLUECATFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWalleye ? (
          <Image
            source={caught ? WALLEYE_UNLOCKED : WALLEYE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isNorthernPike ? (
          <Image
            source={caught ? NORTHERNPIKE_UNLOCKED : NORTHERNPIKE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isRainbowTrout ? (
          <Image
            source={caught ? RAINBOWTROUT_UNLOCKED : RAINBOWTROUT_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBrownTrout ? (
          <Image
            source={caught ? BROWNTROUT_UNLOCKED : BROWNTROUT_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBrookTrout ? (
          <Image
            source={caught ? BROOKTROUT_UNLOCKED : BROOKTROUT_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isMuskie ? (
          <Image
            source={caught ? MUSKIE_UNLOCKED : MUSKIE_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isCarp ? (
          <Image
            source={caught ? CARP_UNLOCKED : CARP_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhiteBass ? (
          <Image
            source={caught ? WHITEBASS_UNLOCKED : WHITEBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isYellowPerch ? (
          <Image
            source={caught ? YELLOWPERCH_UNLOCKED : YELLOWPERCH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isDrumFreshwater ? (
          <Image
            source={caught ? DRUMFRESHWATER_UNLOCKED : DRUMFRESHWATER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isGar ? (
          <Image
            source={caught ? GAR_UNLOCKED : GAR_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isStingray ? (
          <Image
            source={caught ? STINGRAY_UNLOCKED : STINGRAY_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPinfish ? (
          <Image
            source={caught ? PINFISH_UNLOCKED : PINFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPigfish ? (
          <Image
            source={caught ? PIGFISH_UNLOCKED : PIGFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPufferfish ? (
          <Image
            source={caught ? PUFFERFISH_UNLOCKED : PUFFERFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWahoo ? (
          <Image
            source={caught ? WAHOO_UNLOCKED : WAHOO_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isYellowfinTuna ? (
          <Image
            source={caught ? YELLOWFINTUNA_UNLOCKED : YELLOWFINTUNA_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBluefinTuna ? (
          <Image
            source={caught ? BLUEFINTUNA_UNLOCKED : BLUEFINTUNA_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isKingfish ? (
          <Image
            source={caught ? KINGFISH_UNLOCKED : KINGFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSailfish ? (
          <Image
            source={caught ? SAILFISH_UNLOCKED : SAILFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhiteMarlin ? (
          <Image
            source={caught ? WHITEMARLIN_UNLOCKED : WHITEMARLIN_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBluefish ? (
          <Image
            source={caught ? BLUEFISH_UNLOCKED : BLUEFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isMahiMahi ? (
          <Image
            source={caught ? MAHIMAHI_UNLOCKED : MAHIMAHI_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isCobia ? (
          <Image
            source={caught ? COBIA_UNLOCKED : COBIA_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isRedSnapper ? (
          <Image
            source={caught ? REDSNAPPER_UNLOCKED : REDSNAPPER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isMangroveSnapper ? (
          <Image
            source={caught ? MANGROVESNAPPER_UNLOCKED : MANGROVESNAPPER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isYellowtailSnapper ? (
          <Image
            source={caught ? YELLOWTAILSNAPPER_UNLOCKED : YELLOWTAILSNAPPER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isAmberjack ? (
          <Image
            source={caught ? AMBERJACK_UNLOCKED : AMBERJACK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isGrouper ? (
          <Image
            source={caught ? GROUPER_UNLOCKED : GROUPER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isStripedBass ? (
          <Image
            source={caught ? STRIPEDBASS_UNLOCKED : STRIPEDBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWeakfish ? (
          <Image
            source={caught ? WEAKFISH_UNLOCKED : WEAKFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBarracuda ? (
          <Image
            source={caught ? BARRACUDA_UNLOCKED : BARRACUDA_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isTriggerfish ? (
          <Image
            source={caught ? TRIGGERFISH_UNLOCKED : TRIGGERFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSeaBass ? (
          <Image
            source={caught ? SEABASS_UNLOCKED : SEABASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPorgy ? (
          <Image
            source={caught ? PORGY_UNLOCKED : PORGY_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isHogfish ? (
          <Image
            source={caught ? HOGFISH_UNLOCKED : HOGFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isTripletail ? (
          <Image
            source={caught ? TRIPLETAIL_UNLOCKED : TRIPLETAIL_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBonefish ? (
          <Image
            source={caught ? BONEFISH_UNLOCKED : BONEFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPermit ? (
          <Image
            source={caught ? PERMIT_UNLOCKED : PERMIT_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBonito ? (
          <Image
            source={caught ? BONITO_UNLOCKED : BONITO_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isCroaker ? (
          <Image
            source={caught ? CROAKER_UNLOCKED : CROAKER_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isToadfish ? (
          <Image
            source={caught ? TOADFISH_UNLOCKED : TOADFISH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhiting ? (
          <Image
            source={caught ? WHITING_UNLOCKED : WHITING_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSandbarShark ? (
          <Image
            source={caught ? SANDBARSHARK_UNLOCKED : SANDBARSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBlacktipShark ? (
          <Image
            source={caught ? BLACKTIPSHARK_UNLOCKED : BLACKTIPSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSpinnerShark ? (
          <Image
            source={caught ? SPINNERSHARK_UNLOCKED : SPINNERSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSharpnoseShark ? (
          <Image
            source={caught ? SHARPNOSESHARK_UNLOCKED : SHARPNOSESHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBonnetheadShark ? (
          <Image
            source={caught ? BONNETHEADSHARK_UNLOCKED : BONNETHEADSHARK_LOCKED}
            style={styles.stampImageBonnethead}
            resizeMode="contain"
          />
        ) : isHammerheadShark ? (
          <Image
            source={caught ? HAMMERHEADSHARK_UNLOCKED : HAMMERHEADSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isMakoShark ? (
          <Image
            source={caught ? MAKOSHARK_UNLOCKED : MAKOSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBullShark ? (
          <Image
            source={caught ? BULLSHARK_UNLOCKED : BULLSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isTigerShark ? (
          <Image
            source={caught ? TIGERSHARK_UNLOCKED : TIGERSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isThresherShark ? (
          <Image
            source={caught ? THRESHERSHARK_UNLOCKED : THRESHERSHARK_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isAtlanticSturgeon ? (
          <Image
            source={caught ? ATLANTICSTURGEON_UNLOCKED : ATLANTICSTURGEON_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSteelhead ? (
          <Image
            source={caught ? STEELHEAD_UNLOCKED : STEELHEAD_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhiteSturgeon ? (
          <Image
            source={caught ? WHITESTURGEON_UNLOCKED : WHITESTURGEON_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isBowfin ? (
          <Image
            source={caught ? BOWFIN_UNLOCKED : BOWFIN_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPeacockBass ? (
          <Image
            source={caught ? PEACOCKBASS_UNLOCKED : PEACOCKBASS_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWarmouth ? (
          <Image
            source={caught ? WARMOUTH_UNLOCKED : WARMOUTH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isPickerel ? (
          <Image
            source={caught ? PICKEREL_UNLOCKED : PICKEREL_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isWhitePerch ? (
          <Image
            source={caught ? WHITEPERCH_UNLOCKED : WHITEPERCH_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isThreadfinShad ? (
          <Image
            source={caught ? THREADFINSHAD_UNLOCKED : THREADFINSHAD_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isAmericanShad ? (
          <Image
            source={caught ? AMERICANSHAD_UNLOCKED : AMERICANSHAD_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isTilapia ? (
          <Image
            source={caught ? TILAPIA_UNLOCKED : TILAPIA_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : isSnakehead ? (
          <Image
            source={caught ? SNAKEHEAD_UNLOCKED : SNAKEHEAD_LOCKED}
            style={styles.stampImage}
            resizeMode="contain"
          />
        ) : showCaughtImage ? (
          <Image
            source={typeof speciesImageUri === 'number' ? speciesImageUri : { uri: speciesImageUri }}
            style={styles.stampImage}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <FishIcon
            speciesId={species.id}
            caught={caught}
            size={STAMP_ICON_SIZE}
            lockedColor={LOCKED_FISH_GREY}
            caughtColor={ACCENT_BLUE}
          />
        )}
      </View>

      <Text
        style={[styles.stampName, caught ? styles.stampNameCaught : styles.stampNameLocked]}
        numberOfLines={2}
      >
        {species.name}
      </Text>
      <View
        style={[
          styles.rarityBadge,
          { backgroundColor: RARITY_COLORS[species.rarity] + '30', borderColor: RARITY_COLORS[species.rarity] },
        ]}
      >
        <Text style={[styles.rarityText, { color: RARITY_COLORS[species.rarity] }]}>
          {species.rarity.charAt(0).toUpperCase() + species.rarity.slice(1)}
        </Text>
      </View>
      <Text style={styles.stampCount}>
        Total caught: {count}
      </Text>
      {caught ? (
        <View style={styles.caughtBadge}>
          <Ionicons name="checkmark-circle" size={18} color={ACCENT_BLUE} />
        </View>
      ) : (
        <View style={styles.lockBadge}>
          <Feather name="lock" size={13} color={colors.lightSubtext} />
        </View>
      )}
    </Animated.View>
    </TouchableOpacity>
  );
}

type CatchRow = {
  id: string;
  species: string;
  weight_lb?: number;
  length_in?: number;
  photo_url?: string;
  taken_at?: string;
};

export default function PassportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ speciesId?: string }>();
  const { user } = useAuthContext();
  const { caughtSpecies, caughtSpeciesCount, loaded } = useGamificationContext();
  const bottomPadding = useBottomSafePadding();
  const [activeTab, setActiveTab] = useState<'saltwater' | 'freshwater'>('saltwater');
  const [filterUnlocked, setFilterUnlocked] = useState(false);
  const [filterRarity, setFilterRarity] = useState<SpeciesRarity | null>(null);
  const [showStampEffect, setShowStampEffect] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<{ id: string; name: string } | null>(null);
  const [speciesCatches, setSpeciesCatches] = useState<CatchRow[]>([]);
  const [catchesLoading, setCatchesLoading] = useState(false);

  const loadCatchesForSpecies = useCallback(async (speciesId: string) => {
    if (!user?.id) {
      setSpeciesCatches([]);
      return;
    }
    setCatchesLoading(true);
    try {
      const { data } = await getUserCatches(user.id, 2000, 0);
      const filtered = (data || []).filter(
        (c) => findPassportSpeciesId(c.species || '') === speciesId
      ) as CatchRow[];
      setSpeciesCatches(filtered);
    } catch {
      setSpeciesCatches([]);
    } finally {
      setCatchesLoading(false);
    }
  }, [user?.id]);

  const handleStampPress = useCallback(
    (species: { id: string; name: string }) => {
      setSelectedSpecies(species);
      loadCatchesForSpecies(species.id);
    },
    [loadCatchesForSpecies]
  );

  // Navigate to specific species when arriving with speciesId param (from New Species overlay)
  useEffect(() => {
    const speciesId = params.speciesId;
    if (speciesId && loaded) {
      const species = PASSPORT_SPECIES.find((s) => s.id === speciesId);
      if (species) {
        setActiveTab(species.category as 'saltwater' | 'freshwater');
        setSelectedSpecies({ id: species.id, name: species.name });
        loadCatchesForSpecies(species.id);
      }
    }
  }, [params.speciesId, loaded, loadCatchesForSpecies]);

  const freshwater = PASSPORT_SPECIES.filter((s) => s.category === 'freshwater');
  const saltwater = PASSPORT_SPECIES.filter((s) => s.category === 'saltwater');

  const freshwaterCaught = freshwater.filter((s) => caughtSpecies.has(s.id)).length;
  const saltwaterCaught = saltwater.filter((s) => caughtSpecies.has(s.id)).length;

  const baseList = activeTab === 'saltwater' ? saltwater : freshwater;
  const currentList = baseList.filter((s) => {
    if (filterUnlocked && !caughtSpecies.has(s.id)) return false;
    if (filterRarity && s.rarity !== filterRarity) return false;
    return true;
  });
  const currentCaught = activeTab === 'saltwater' ? saltwaterCaught : freshwaterCaught;
  const currentTotal = activeTab === 'saltwater' ? saltwater.length : freshwater.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SnaggedWordmark />
          <Text style={styles.subtitle} numberOfLines={1}>Fishing Passport</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress bars */}
      <View style={[styles.progressSection, cardShadow]}>
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Saltwater</Text>
          <Text style={styles.progressValue}>
              {saltwaterCaught}/{saltwater.length}
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                  { width: `${saltwater.length > 0 ? (saltwaterCaught / saltwater.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Freshwater</Text>
            <Text style={styles.progressValue}>
              {freshwaterCaught}/{freshwater.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${freshwater.length > 0 ? (freshwaterCaught / freshwater.length) * 100 : 0}%` },
                ]}
              />
          </View>
          </View>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saltwater' && styles.tabActive]}
          onPress={() => setActiveTab('saltwater')}
        >
          <Ionicons
            name="water"
            size={18}
            color={activeTab === 'saltwater' ? '#FFF' : colors.lightSubtext}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'saltwater' && styles.tabTextActive,
            ]}
          >
            Saltwater
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'freshwater' && styles.tabActive]}
          onPress={() => setActiveTab('freshwater')}
        >
          <Ionicons
            name="leaf"
            size={18}
            color={activeTab === 'freshwater' ? '#FFF' : colors.lightSubtext}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'freshwater' && styles.tabTextActive,
            ]}
          >
            Freshwater
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              !filterUnlocked && filterRarity === null && styles.filterChipActive,
            ]}
            onPress={() => {
              setFilterUnlocked(false);
              setFilterRarity(null);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                !filterUnlocked && filterRarity === null && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterUnlocked && styles.filterChipActive]}
            onPress={() => setFilterUnlocked((v) => !v)}
          >
            <Feather name="unlock" size={14} color={filterUnlocked ? '#FFF' : colors.lightSubtext} />
            <Text style={[styles.filterChipText, filterUnlocked && styles.filterChipTextActive]}>
              Unlocked
            </Text>
          </TouchableOpacity>
          {RARITY_ORDER.map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.filterChip,
                filterRarity === r && styles.filterChipActive,
                filterRarity === r && { backgroundColor: RARITY_COLORS[r] },
              ]}
              onPress={() => setFilterRarity((prev) => (prev === r ? null : r))}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterRarity === r && styles.filterChipTextActive,
                ]}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </View>

      <ScrollView
        contentContainerStyle={[styles.gridContainer, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Passport layout is the same for all users (PASSPORT_SPECIES); only caught/unlocked state is personalized. */}
        <View style={styles.grid}>
          {currentList.map((s) => (
            <SpeciesStamp
              key={s.id}
              species={s}
              caught={caughtSpecies.has(s.id)}
              count={caughtSpeciesCount[s.id] ?? 0}
              justStamped={showStampEffect === s.id}
              onPress={() => handleStampPress(s)}
            />
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal: catches for selected species */}
      <Modal
        visible={!!selectedSpecies}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedSpecies(null)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalSnaggedWrap}>
              <SnaggedWordmark />
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedSpecies(null)}
              activeOpacity={0.7}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Feather name="x" size={24} color={colors.lightText} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedSpecies?.name ?? ''}
            </Text>
            <Text style={styles.modalSubtitle}>
              Catches you&apos;ve logged
            </Text>
          </View>
          {catchesLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={ACCENT_BLUE} />
              <Text style={styles.modalLoadingText}>Loading catches...</Text>
            </View>
          ) : !user?.id ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>Sign in to see your catches</Text>
            </View>
          ) : speciesCatches.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>No catches logged for this species yet</Text>
            </View>
          ) : (
            <FlatList
              data={speciesCatches}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.catchListContent}
              renderItem={({ item }) => {
                const dateStr = formatCatchDate(item.taken_at);
                return (
                  <TouchableOpacity
                    style={styles.catchRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedSpecies(null);
                      router.push(`/catch/${item.id}`);
                    }}
                  >
                    {item.photo_url && isValidImageUri(item.photo_url) ? (
                      <Image
                        source={{ uri: item.photo_url }}
                        style={styles.catchRowPhoto}
                      />
                    ) : (
                      <View style={[styles.catchRowPhoto, styles.catchRowPhotoPlaceholder]}>
                        <Feather name="image" size={40} color={colors.lightSubtext} />
                      </View>
                    )}
                    <View style={styles.catchRowInfo}>
                      {dateStr ? <Text style={styles.catchRowDate}>{dateStr}</Text> : null}
                      {(item.weight_lb != null || item.length_in != null) && (
                        <Text style={styles.catchRowMeta}>
                          {[
                            item.weight_lb != null && `${item.weight_lb} lb`,
                            item.length_in != null && `${item.length_in}"`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={24} color={colors.lightSubtext} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  subtitle: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  headerSpacer: { width: 40 },
  progressSection: {
    backgroundColor: colors.lightCard,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 20,
  },
  progressItem: {
    flex: 1,
    minWidth: 0,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT_BLUE,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lightCardBlue,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 4,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: ACCENT_BLUE,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  tabTextActive: {
    color: '#FFF',
  },
  filterRow: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  filterChipActive: {
    backgroundColor: ACCENT_BLUE,
    borderColor: ACCENT_BLUE,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  gridContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  stampTouchable: {
    width: CARD_WIDTH,
  },
  stamp: {
    width: '100%',
    minHeight: 200,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  stampLocked: {
    backgroundColor: '#E8E8E8',
    borderColor: colors.lightBorder,
    opacity: 0.85,
  },
  stampCaught: {
    backgroundColor: colors.lightCardBlue,
    borderWidth: 3,
    borderColor: ACCENT_BLUE,
  },
  stampIconWrap: {
    marginTop: 8,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: STAMP_ICON_SIZE * (120 / 70),
    height: STAMP_ICON_SIZE,
  },
  stampImage: {
    width: STAMP_ICON_SIZE * (120 / 70),
    height: STAMP_ICON_SIZE,
    borderRadius: 6,
    marginTop: 18,
  },
  stampImageBonnethead: {
    width: STAMP_ICON_SIZE * (120 / 70) * 1.4,
    height: STAMP_ICON_SIZE * 1.4,
    borderRadius: 6,
    marginTop: 18,
  },
  caughtBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    opacity: 0.6,
  },
  stampName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  rarityBadge: {
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stampNameLocked: {
    color: colors.lightSubtext,
  },
  stampNameCaught: {
    color: colors.lightText,
  },
  stampCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginTop: 2,
  },
  // Species catches modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  modalSnaggedWrap: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  modalCloseBtn: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 15,
    color: colors.lightSubtext,
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalEmptyText: {
    fontSize: 16,
    color: colors.lightSubtext,
    textAlign: 'center',
  },
  catchListContent: {
    padding: 16,
    paddingBottom: 40,
  },
  catchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  catchRowPhoto: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.lightBorder,
  },
  catchRowPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  catchRowInfo: {
    flex: 1,
    marginLeft: 16,
  },
  catchRowDate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  catchRowMeta: {
    fontSize: 15,
    color: colors.lightSubtext,
    marginTop: 4,
  },
});
