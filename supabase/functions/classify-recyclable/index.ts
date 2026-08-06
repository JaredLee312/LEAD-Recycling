// Supabase Edge Function: classify-recyclable
//
// Receives a photo (base64) from the browser, sends it to the Claude API for
// vision-based recycling classification, and returns a small structured
// result. The real Anthropic API key lives only here (as an Edge Function
// secret) -- it is never sent to the browser. Deployed with the default
// verify_jwt = true, so only signed-in users (a valid Supabase session) can
// call this at all; that's the same "gate the costly action behind login"
// pattern used for reports and recycling log entries elsewhere in this app.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches MAX_PHOTO_BYTES in js/reports.js
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    item: {
      type: "string",
      description: "Short name of the item identified in the photo, e.g. 'plastic water bottle'",
    },
    recyclable: {
      type: "boolean",
      description: "Whether this item can be recycled through one of BinFinderSG's four bin categories",
    },
    category: {
      type: "string",
      enum: ["blue-bin", "e-waste", "textile", "bcrs", "none"],
      description: "Which bin category it belongs to, or 'none' if not recyclable through any of them",
    },
    reason: {
      type: "string",
      description: "One or two friendly sentences explaining the verdict, specific to what's visible in the photo",
    },
  },
  required: ["item", "recyclable", "category", "reason"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the recycling assistant for BinFinderSG, a Singapore recycling bin locator. \
A user has uploaded a photo of an item and wants to know if it can be recycled, and where.

BinFinderSG supports exactly four recycling streams:
- blue-bin: paper, plastic bottles/containers, glass bottles/jars, metal cans and drink cartons
- e-waste: electronics, batteries, small appliances, light bulbs
- textile: clean clothing, shoes, bags, linens
- bcrs: empty PET plastic drink bottles and metal drink cans specifically carrying a deposit refund logo

Look at the photo and identify the item. Decide whether it fits one of these four streams. If it \
doesn't fit any of them (e.g. food waste, styrofoam, ceramics, broken glass, general trash, or \
anything you can't clearly identify), say it isn't recyclable through these bins and briefly say why. \
Be concise, specific to what's actually visible in the photo, and friendly.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "Assistant isn't set up yet. Please check back soon." }, 503);
  }

  let payload: { imageBase64?: string; mimeType?: string; note?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const { imageBase64, mimeType, note } = payload;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return jsonResponse({ error: "No photo was provided." }, 400);
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return jsonResponse({ error: "Please upload a JPEG, PNG, WEBP, or GIF image." }, 400);
  }
  // Base64 is ~4/3 the size of the original bytes -- check against that inflated figure.
  if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
    return jsonResponse({ error: "Photo must be under 10 MB." }, 400);
  }

  const userText = note && typeof note === "string" && note.trim()
    ? `What is this item, and can it be recycled? Extra context from the user: ${note.trim().slice(0, 300)}`
    : "What is this item, and can it be recycled?";

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
              { type: "text", text: userText },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
      }),
    });
  } catch {
    return jsonResponse({ error: "Couldn't reach the AI service. Please try again." }, 502);
  }

  if (!anthropicResponse.ok) {
    const status = anthropicResponse.status === 429 ? 429 : 502;
    return jsonResponse(
      { error: status === 429 ? "Too many requests right now — please try again shortly." : "Something went wrong analyzing that photo." },
      status,
    );
  }

  const data = await anthropicResponse.json();

  if (data.stop_reason === "refusal") {
    return jsonResponse({ error: "Couldn't analyze that photo. Please try a different one." }, 200);
  }

  const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
  if (!textBlock) {
    return jsonResponse({ error: "Something went wrong analyzing that photo." }, 502);
  }

  try {
    const result = JSON.parse(textBlock.text);
    return jsonResponse({ result });
  } catch {
    return jsonResponse({ error: "Something went wrong analyzing that photo." }, 502);
  }
});
