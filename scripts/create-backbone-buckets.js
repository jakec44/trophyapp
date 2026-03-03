#!/usr/bin/env node
/**
 * Create storage buckets for the clean backbone.
 * Run: node scripts/create-backbone-buckets.js
 * Requires: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY) in .env.local
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

const BUCKETS = [
  { id: 'avatars', public: true, fileSizeLimit: 5242880, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  { id: 'catch-photos', public: true, fileSizeLimit: 10485760, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  { id: 'catches', public: true, fileSizeLimit: 5242880, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
];

async function main() {
  for (const b of BUCKETS) {
    const { error } = await supabase.storage.createBucket(b.id, {
      public: b.public,
      fileSizeLimit: b.fileSizeLimit,
      allowedMimeTypes: b.allowedMimeTypes,
    });
    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log(`Bucket "${b.id}" already exists.`);
      } else {
        console.error(`Bucket "${b.id}":`, error.message);
      }
    } else {
      console.log(`Bucket "${b.id}" created.`);
    }
  }
}

main();
