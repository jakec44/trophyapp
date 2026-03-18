/**
 * Example image URLs for species (fallback when user has no photo).
 * Local assets use require(); remote use URL strings.
 */

const PICSUM = (seed: string, w = 400, h = 300) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const SPECIES_EXAMPLE_IMAGES: Record<string, string | number> = {
  // Saltwater
  'red-drum': PICSUM('redfish'),
  'snook': PICSUM('snook'),
  'spotted-seatrout': PICSUM('trout'),
  'flounder': PICSUM('flounder'),
  'sheepshead': PICSUM('sheepshead'),
  'black-drum': PICSUM('blackdrum'),
  'spanish-mackerel': PICSUM('mackerel'),
  'king-mackerel': PICSUM('kingmackerel'),
  'pompano': PICSUM('pompano'),
  'jack-crevalle': PICSUM('jack'),
  'ladyfish': PICSUM('ladyfish'),
  'bluefish': PICSUM('bluefish'),
  'tarpon': PICSUM('tarpon'),
  'mahi-mahi': PICSUM('mahi'),
  'cobia': PICSUM('cobia'),
  'red-snapper': PICSUM('redsnapper'),
  'mangrove-snapper': PICSUM('snapper'),
  'yellowtail-snapper': PICSUM('yellowsnapper'),
  'vermillion-snapper': PICSUM('vermillionsnapper'),
  'amberjack': PICSUM('amberjack'),
  'grouper': PICSUM('grouper'),
  'striped-bass': PICSUM('striped'),
  'weakfish': PICSUM('weakfish'),
  'barracuda': PICSUM('barracuda'),
  'triggerfish': PICSUM('trigger'),
  'sea-bass': PICSUM('seabass'),
  'porgy': PICSUM('porgy'),
  'hogfish': PICSUM('hogfish'),
  'tripletail': PICSUM('tripletail'),
  'bonefish': PICSUM('bonefish'),
  'permit': PICSUM('permit'),
  'pinfish': PICSUM('pinfish'),
  'stingray': PICSUM('stingray'),
  'pigfish': PICSUM('pigfish'),
  'pufferfish': PICSUM('pufferfish'),
  'wahoo': PICSUM('wahoo'),
  'yellowfin-tuna': PICSUM('yellowfintuna'),
  'bluefin-tuna': PICSUM('bluefintuna'),
  'kingfish': PICSUM('kingfish'),
  'sailfish': PICSUM('sailfish'),
  'white-marlin': PICSUM('whitemarlin'),
  // Freshwater
  'largemouth-bass': PICSUM('bass'),
  'smallmouth-bass': PICSUM('smallbass'),
  'spotted-bass': PICSUM('spottedbass'),
  'crappie-black': PICSUM('crappie'),
  'crappie-white': PICSUM('crappiew'),
  'bluegill': PICSUM('bluegill'),
  'pumpkinseed': PICSUM('pumpkinseed'),
  'channel-catfish': PICSUM('catfish'),
  'flathead-catfish': PICSUM('flathead'),
  'blue-catfish': PICSUM('bluecat'),
  'walleye': PICSUM('walleye'),
  'northern-pike': PICSUM('pike'),
  'rainbow-trout': PICSUM('rainbow'),
  'brown-trout': PICSUM('browntrout'),
  'brook-trout': PICSUM('brooktrout'),
  'tiger-trout': PICSUM('tigertrout'),
  'muskie': PICSUM('muskie'),
  'carp': PICSUM('carp'),
  'grass-carp': PICSUM('grasscarp'),
  'white-bass': PICSUM('whitebass'),
  'yellow-perch': PICSUM('perch'),
  'drum-freshwater': PICSUM('drum'),
  'gar': PICSUM('gar'),
  'bowfin': require('../../assets/bowfin.png'),
  'american-shad': require('../../assets/american-shad.png'),
  'threadfin-shad': require('../../assets/threadfin-shad.png'),
  'white-perch': require('../../assets/white-perch.png'),
  'pickerel': require('../../assets/pickerel.png'),
  'warmouth': require('../../assets/warmouth.png'),
  'peacock-bass': require('../../assets/peacock-bass.png'),
  'snakehead': require('../../assets/snakehead.png'),
  'clown-knifefish': PICSUM('clownknife'),
  'white-sturgeon': require('../../assets/white-sturgeon.png'),
  'atlantic-sturgeon': require('../../assets/atlantic-sturgeon.png'),
  'steelhead': require('../../assets/steelhead.png'),
  'salmon': require('../../assets/salmon.png'),
  'tilapia': require('../../assets/tilapia.png'),
};

/** Match species name to passport id for example lookup */
export function findSpeciesIdForExample(speciesName: string, allIds: string[]): string | null {
  const lower = (speciesName || '').toLowerCase().trim();
  if (!lower) return null;
  for (const id of allIds) {
    const namePart = id.replace(/-/g, ' ');
    if (lower.includes(namePart) || namePart.includes(lower)) return id;
  }
  return null;
}
