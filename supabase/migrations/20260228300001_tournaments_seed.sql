-- Seed demo tournament entries (only if profiles exist)

DO $$
DECLARE
  profiles_used uuid[];
  i int;
  seed_entries jsonb;
BEGIN
  SELECT ARRAY_AGG(id ORDER BY id) INTO profiles_used
  FROM (SELECT id FROM profiles LIMIT 10) p;

  IF profiles_used IS NULL OR array_length(profiles_used, 1) < 1 THEN
    RETURN;
  END IF;

  seed_entries := '[
    {"t":"biggest-fish-this-week","s":"Tarpon","w":null,"l":84,"up":112,"dn":4,"pi":1},
    {"t":"biggest-fish-this-week","s":"Tarpon","w":null,"l":78,"up":98,"dn":3,"pi":2},
    {"t":"biggest-fish-this-week","s":"Tarpon","w":null,"l":72,"up":85,"dn":2,"pi":0},
    {"t":"tournament-bass","s":"Largemouth Bass","w":12.3,"l":26,"up":42,"dn":2,"pi":0},
    {"t":"tournament-bass","s":"Largemouth Bass","w":11.8,"l":24,"up":28,"dn":1,"pi":1},
    {"t":"tournament-bass","s":"Rainbow Trout","w":9.5,"l":28,"up":15,"dn":0,"pi":2},
    {"t":"tournament-redfish","s":"Redfish","w":null,"l":35,"up":88,"dn":3,"pi":0},
    {"t":"tournament-redfish","s":"Redfish","w":null,"l":32,"up":56,"dn":2,"pi":1},
    {"t":"tournament-snook","s":"Snook","w":14.2,"l":38,"up":95,"dn":2,"pi":0},
    {"t":"tournament-snook","s":"Snook","w":11.5,"l":34,"up":67,"dn":1,"pi":2},
    {"t":"tournament-flounder","s":"Flounder","w":5.8,"l":22,"up":34,"dn":1,"pi":1},
    {"t":"tournament-striper","s":"Striped Bass","w":18.1,"l":36,"up":120,"dn":3,"pi":1},
    {"t":"tournament-striper","s":"Striped Bass","w":15.2,"l":32,"up":78,"dn":1,"pi":0},
    {"t":"tournament-smallest","s":"Bluegill","w":0.4,"l":6,"up":12,"dn":0,"pi":2},
    {"t":"tournament-smallest","s":"Black Crappie","w":0.6,"l":8,"up":18,"dn":1,"pi":1}
  ]'::jsonb;

  FOR i IN 0..jsonb_array_length(seed_entries) - 1
  LOOP
    DECLARE
      rec jsonb := seed_entries->i;
      tid text := rec->>'t';
      species text := rec->>'s';
      w numeric := (rec->>'w')::numeric;
      ln numeric := (rec->>'l')::numeric;
      up int := (rec->>'up')::int;
      dn int := (rec->>'dn')::int;
      pi int := LEAST((rec->>'pi')::int, array_length(profiles_used, 1) - 1);
      uid uuid := profiles_used[pi + 1];
      eid text := 'seed-' || tid || '-' || i;
    BEGIN
      INSERT INTO tournament_entries (
        id, tournament_id, user_id, username, image_url,
        species, weight_lb, length_in, up_votes, down_votes
      )
      VALUES (
        eid,
        tid,
        uid,
        COALESCE((SELECT display_name FROM profiles WHERE id = uid), 'Angler'),
        'https://picsum.photos/seed/' || eid || '/400/300',
        species,
        w,
        ln,
        COALESCE(up, 0),
        COALESCE(dn, 0)
      )
      ON CONFLICT ON CONSTRAINT tournament_entries_user_unique DO NOTHING;
    END;
  END LOOP;
END $$;
