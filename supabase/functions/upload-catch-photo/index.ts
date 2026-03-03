// Supabase Edge Function: upload-catch-photo
// Input: { base64: string, userId: string }
// Output: { publicUrl: string }
// Uploads base64 image to the single media bucket. Path: {userId}/catches/{uuid}.jpg

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEDIA_BUCKET = "media";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const body = (await req.json()) as { base64?: string; userId?: string };
    const { base64, userId } = body;

    if (!base64 || typeof base64 !== "string" || !userId || typeof userId !== "string") {
      return Response.json(
        { error: "Missing base64 or userId" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${userId}/catches/${crypto.randomUUID()}.jpg`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, binary, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("Storage upload error:", error);
      return Response.json(
        { error: error.message },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    return Response.json(
      { publicUrl },
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (e) {
    console.error("upload-catch-photo error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
