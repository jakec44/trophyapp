#!/usr/bin/env node
/**
 * Create the 'catches' storage bucket.
 * Run: node scripts/create-catches-bucket.js
 * Requires: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * Or use service role key for createBucket (anon may not have permission).
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or keys. Check .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.storage.createBucket('catches', {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (error) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('Bucket "catches" already exists.');
      return;
    }
    console.error('Error:', error.message);
    console.log('\nCreate manually: Supabase Dashboard → Storage → New bucket → name: catches, Public: ON');
    process.exit(1);
  }

  console.log('Bucket "catches" created successfully.');
}

main();
