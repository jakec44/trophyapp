/**
 * Seed Firestore with tournament documents. endsAt staggered 3–7 days from now.
 * Run with Node (requires firebase-admin and a service account key):
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json node scripts/seed-tournaments.js
 *
 * Or set FIREBASE_PROJECT_ID and use Application Default Credentials.
 */

const admin = require('firebase-admin');

const TOURNAMENT_IDS = {
  BIGGEST_FISH: 'biggest-fish-this-week',
  BIGGEST_REDFISH: 'tournament-redfish',
  BIGGEST_BASS: 'tournament-bass',
  BIGGEST_SNOOK: 'tournament-snook',
  BIGGEST_FLOUNDER: 'tournament-flounder',
  BIGGEST_STRIPER: 'tournament-striper',
  BIGGEST_TARPON: 'tournament-tarpon',
  SMALLEST_FISH: 'tournament-smallest',
};

const TOURNAMENTS = [
  { id: TOURNAMENT_IDS.BIGGEST_FISH, type: 'BIGGEST_FISH', title: 'Biggest Fish', metricType: 'LENGTH_IN', daysFromNow: 7 },
  { id: TOURNAMENT_IDS.BIGGEST_REDFISH, type: 'BIGGEST_REDFISH', title: 'Redfish', metricType: 'LENGTH_IN', daysFromNow: 5 },
  { id: TOURNAMENT_IDS.BIGGEST_BASS, type: 'BIGGEST_BASS', title: 'Bass', metricType: 'WEIGHT_LBS', daysFromNow: 4 },
  { id: TOURNAMENT_IDS.BIGGEST_SNOOK, type: 'BIGGEST_SNOOK', title: 'Snook', metricType: 'LENGTH_IN', daysFromNow: 6 },
  { id: TOURNAMENT_IDS.BIGGEST_FLOUNDER, type: 'BIGGEST_FLOUNDER', title: 'Flounder', metricType: 'LENGTH_IN', daysFromNow: 3 },
  { id: TOURNAMENT_IDS.BIGGEST_STRIPER, type: 'BIGGEST_STRIPER', title: 'Striper', metricType: 'LENGTH_IN', daysFromNow: 5 },
  { id: TOURNAMENT_IDS.BIGGEST_TARPON, type: 'BIGGEST_TARPON', title: 'Tarpon', metricType: 'LENGTH_IN', daysFromNow: 4 },
  { id: TOURNAMENT_IDS.SMALLEST_FISH, type: 'SMALLEST_FISH', title: 'Smallest Fish', metricType: 'LENGTH_IN', daysFromNow: 6 },
];

function getEndsAt(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();
  const batch = db.batch();
  const now = new Date();

  for (const t of TOURNAMENTS) {
    const endsAt = getEndsAt(t.daysFromNow);
    const ref = db.collection('tournaments').doc(t.id);
    batch.set(ref, {
      type: t.type,
      title: t.title,
      metricType: t.metricType,
      endsAt,
      createdAt: now.toISOString(),
    });
  }

  await batch.commit();
  console.log('Seeded', TOURNAMENTS.length, 'tournaments with endsAt 3–7 days from now.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
