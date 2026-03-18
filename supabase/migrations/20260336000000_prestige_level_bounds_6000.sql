-- Align prestige_now() level calculation with LEVEL_ROADMAP (L15 = 6000 XP total).
-- Progression: L1=0, L2=100, L3=250, L4=450, L5=700, L6=1000, L7=1350, L8=1750, L9=2200,
-- L10=2700, L11=3250, L12=3850, L13=4500, L14=5200, L15=6000.

CREATE OR REPLACE FUNCTION prestige_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile RECORD;
  v_level int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  SELECT total_xp, prestige, angler_rating INTO v_profile
  FROM profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'profile_not_found');
  END IF;

  -- Level from total_xp (matches app LEVEL_ROADMAP: L15 = 6000)
  v_level := 1;
  IF v_profile.total_xp >= 6000 THEN v_level := 15;
  ELSIF v_profile.total_xp >= 5200 THEN v_level := 14;
  ELSIF v_profile.total_xp >= 4500 THEN v_level := 13;
  ELSIF v_profile.total_xp >= 3850 THEN v_level := 12;
  ELSIF v_profile.total_xp >= 3250 THEN v_level := 11;
  ELSIF v_profile.total_xp >= 2700 THEN v_level := 10;
  ELSIF v_profile.total_xp >= 2200 THEN v_level := 9;
  ELSIF v_profile.total_xp >= 1750 THEN v_level := 8;
  ELSIF v_profile.total_xp >= 1350 THEN v_level := 7;
  ELSIF v_profile.total_xp >= 1000 THEN v_level := 6;
  ELSIF v_profile.total_xp >= 700 THEN v_level := 5;
  ELSIF v_profile.total_xp >= 450 THEN v_level := 4;
  ELSIF v_profile.total_xp >= 250 THEN v_level := 3;
  ELSIF v_profile.total_xp >= 100 THEN v_level := 2;
  END IF;

  IF v_level < 15 THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'message', 'Must be level 15 to prestige', 'level', v_level);
  END IF;

  IF COALESCE(v_profile.prestige, 0) >= 3 THEN
    RETURN jsonb_build_object('status', 'max_prestige', 'message', 'Already at max prestige (3)');
  END IF;

  UPDATE profiles
  SET total_xp = 0,
      prestige = LEAST(3, COALESCE(prestige, 0) + 1)
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'prestige', LEAST(3, COALESCE(v_profile.prestige, 0) + 1)
  );
END;
$$;

COMMENT ON FUNCTION prestige_now() IS 'Prestige: reset level to 1 (XP to 0), prestige +1. Requires level 15 (6000 XP), prestige < 3.';
