-- Restrict species mastery badges to Redfish, Snook, Tarpon, Largemouth Bass only.
-- Delete badges for all other species (Hunter/Master/Elite/Legend tiers).
-- badge_key format: species-{slug}-{tier} (e.g. species-red-drum-hunter, species-redfish-hunter)

DELETE FROM species_mastery_badges
WHERE badge_key NOT LIKE 'species-red-drum-%'
  AND badge_key NOT LIKE 'species-redfish-%'
  AND badge_key NOT LIKE 'species-snook-%'
  AND badge_key NOT LIKE 'species-tarpon-%'
  AND badge_key NOT LIKE 'species-largemouth-bass-%';
