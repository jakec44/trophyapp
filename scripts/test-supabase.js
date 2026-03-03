/**
 * Test Supabase connection: read from profiles and catches tables.
 * Run: node scripts/test-supabase.js
 * Loads .env from project root.
 */

const fs = require('fs');
const path = require('path');

// Load .env from project root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (k && v) process.env[k] = v;
    }
  });
}

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== Supabase connection test ===\n');

// 1. Check credentials
console.log('1. CREDENTIALS CHECK');
console.log('   URL:', URL ? `${URL.substring(0, 40)}...` : '(missing)');
console.log('   Key:', KEY ? `${KEY.substring(0, 30)}...` : '(missing)');

const isPlaceholder = !URL || !KEY ||
  URL.includes('placeholder') ||
  KEY === 'placeholder-anon-key';

if (isPlaceholder) {
  console.log('\n   ❌ FAIL: Using placeholder or missing credentials.\n');
  process.exit(1);
}
console.log('   ✓ Real credentials present (not placeholders)\n');

// 2. Create client and query
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(URL, KEY);

async function run() {
  console.log('2. QUERY PROFILES TABLE');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .limit(3);

  if (profilesError) {
    console.log('   ❌ FAIL:', profilesError.message);
    console.log('   Code:', profilesError.code);
    console.log('   Details:', JSON.stringify(profilesError.details, null, 2));
  } else {
    console.log('   ✓ Success');
    console.log('   Rows:', profiles?.length ?? 0);
    if (profiles?.length) {
      profiles.forEach((p, i) => console.log(`   [${i + 1}]`, p.id?.slice(0, 8) + '...', p.display_name || '(no name)'));
    }
  }

  console.log('\n3. QUERY CATCHES TABLE');
  const { data: catches, error: catchesError } = await supabase
    .from('catches')
    .select('id, species, weight_lb')
    .limit(3);

  if (catchesError) {
    console.log('   ❌ FAIL:', catchesError.message);
    console.log('   Code:', catchesError.code);
    console.log('   Details:', JSON.stringify(catchesError.details, null, 2));
  } else {
    console.log('   ✓ Success');
    console.log('   Rows:', catches?.length ?? 0);
    if (catches?.length) {
      catches.forEach((c, i) => console.log(`   [${i + 1}]`, c.species, c.weight_lb, 'lbs'));
    }
  }

  console.log('\n=== Test complete ===');
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
