// Supabase Edge Function: analyze-fish
// Input: { imageUrl: string } OR { storagePath: string, bucket?: string }
// Output: { species, confidence, top3: [{species, confidence}...], estimated_length_in, estimated_weight_lb, notes }
// Constrains species to supported list. If confidence < 0.65, species = "Unknown".
// Uses OpenAI GPT-4o Vision. Set OPENAI_API_KEY in Supabase secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEDIA_BUCKET = "media";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SUPPORTED_SPECIES = [
  "Red Drum (Redfish)", "Snook", "Spotted Seatrout", "Flounder", "Sheepshead", "Black Drum",
  "Spanish Mackerel", "King Mackerel", "Pompano", "Jack Crevalle", "Ladyfish", "Bluefish", "Tarpon",
  "Mahi Mahi", "Cobia", "Red Snapper", "Mangrove Snapper", "Yellowtail Snapper", "Amberjack", "Grouper",
  "Striped Bass", "Weakfish", "Barracuda", "Triggerfish", "Sea Bass", "Porgy", "Hogfish", "Tripletail",
  "Bonefish", "Permit",
  "Largemouth Bass", "Smallmouth Bass", "Spotted Bass", "Crappie (Black)", "Crappie (White)", "Bluegill",
  "Channel Catfish", "Flathead Catfish", "Blue Catfish", "Walleye", "Northern Pike", "Rainbow Trout",
  "Brown Trout", "Brook Trout", "Muskie", "Carp", "White Bass", "Yellow Perch", "Drum (Freshwater)", "Gar",
  "Bowfin", "American Shad", "Threadfin Shad", "White Perch", "Pickerel", "Warmouth", "Peacock Bass",
  "Snakehead", "White Sturgeon", "Atlantic Sturgeon", "Steelhead", "Salmon",
  "Pinfish", "Stingray", "Pigfish", "Pufferfish", "Wahoo", "Yellowfin Tuna", "Bluefin Tuna", "Kingfish",
  "Sailfish", "White Marlin",
];

interface AnalyzeFishInput {
  imageUrl?: string;
  storagePath?: string;
  bucket?: string;
}

interface TopSpecies {
  species: string;
  confidence: number;
}

interface AnalyzeFishOutput {
  species: string;
  confidence: number;
  top3: TopSpecies[];
  estimated_length_in: number;
  estimated_weight_lb: number;
  notes: string;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function matchToSupported(guess: string): { name: string; score: number }[] {
  const g = (guess || "").toLowerCase().trim();
  if (!g) return [];
  const out: { name: string; score: number }[] = [];
  for (const s of SUPPORTED_SPECIES) {
    const sl = s.toLowerCase();
    if (sl === g) out.push({ name: s, score: 1 });
    else if (sl.includes(g) || g.includes(sl)) out.push({ name: s, score: 0.85 });
    else {
      const words = sl.split(/\s+/);
      const match = words.some((w) => w.length >= 4 && g.includes(w.slice(0, 4)));
      if (match) out.push({ name: s, score: 0.6 });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const body = (await req.json()) as AnalyzeFishInput;
    let imageUrl = body.imageUrl;

    if (!imageUrl && body.storagePath) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(body.storagePath);
      imageUrl = data.publicUrl;
      // For private buckets, use createSignedUrl instead - for now assume public
    }

    if (!imageUrl?.trim()) {
      return Response.json(
        { error: "Missing imageUrl or storagePath" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OPENAI_API_KEY not set");
      return Response.json(
        { error: "AI service not configured. Set OPENAI_API_KEY in Supabase secrets." },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompt = `Look at this photo carefully. It shows a fish that was caught. Your job is to:
1. Identify the fish species. You MUST choose exactly one from this list (use the exact name): Red Drum (Redfish), Snook, Spotted Seatrout, Flounder, Sheepshead, Black Drum, Spanish Mackerel, King Mackerel, Pompano, Largemouth Bass, Smallmouth Bass, Spotted Bass, Crappie (Black), Crappie (White), Bluegill, Channel Catfish, Walleye, Northern Pike, Rainbow Trout, Brown Trout, Brook Trout, Mahi Mahi, Red Snapper, Tarpon, Bluefish, Striped Bass, Cobia, Grouper, Barracuda, Carp, Muskie, Gar, Bowfin, American Shad, Threadfin Shad, White Perch, Pickerel, Warmouth, Peacock Bass, Snakehead, White Sturgeon, Atlantic Sturgeon, Steelhead, Salmon, Pinfish, Stingray, Pigfish, Pufferfish, Wahoo, Yellowfin Tuna, Bluefin Tuna, Kingfish, Sailfish, White Marlin. If the fish is not clearly visible or does not match any listed species, use "Unknown".
2. Estimate the weight in pounds based on the fish size in the image (typical adult sizes).
3. Estimate the length in inches based on the fish size.

Respond with ONLY a valid JSON object, no other text: {"species": "Exact Species Name From List", "estimated_weight_lb": number, "estimated_length_in": number}`;

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      throw new Error(`Vision API error: ${res.status}`);
    }

    const data = await res.json();
    const output = (data.choices?.[0]?.message?.content || "").trim();
    const jsonMatch = output.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      species?: string;
      estimated_weight_lb?: number;
      estimated_length_in?: number;
    };

    const rawSpecies = (parsed.species || "").trim() || "";
    const matches = matchToSupported(rawSpecies);
    const topSpecies = matches.slice(0, 3).map((m) => ({
      species: m.name,
      confidence: Math.min(0.99, m.score),
    }));
    const bestMatch = matches[0];
    const confidence = bestMatch ? Math.min(0.99, bestMatch.score) : 0;
    const constrainedSpecies = bestMatch ? bestMatch.name : "Unknown";
    const finalSpecies = confidence < 0.65 ? "Unknown" : constrainedSpecies;

    const result: AnalyzeFishOutput = {
      species: finalSpecies,
      confidence,
      top3: finalSpecies === "Unknown" && topSpecies.length > 0
        ? topSpecies
        : topSpecies.length > 0
          ? topSpecies
          : finalSpecies !== "Unknown"
            ? [{ species: finalSpecies, confidence }]
            : [],
      estimated_length_in: clamp(
        typeof parsed.estimated_length_in === "number" ? parsed.estimated_length_in : 0,
        0.5,
        200
      ),
      estimated_weight_lb: clamp(
        typeof parsed.estimated_weight_lb === "number" ? parsed.estimated_weight_lb : 0,
        0.1,
        500
      ),
      notes: "Estimate based on visible proportions; verify with scale if possible.",
    };

    return Response.json(result, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("analyze-fish error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
