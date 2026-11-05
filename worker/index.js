const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_BODY_BYTES = 48 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12000;

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";

    if (!allowedOrigin) return json({ error: "Worker setup incomplete: ALLOWED_ORIGIN is missing." }, 503, origin);
    if (origin && origin !== allowedOrigin) return json({ error: "Origin not allowed." }, 403, allowedOrigin);
    if (request.method === "POST" && origin !== allowedOrigin) return json({ error: "A valid site Origin header is required." }, 403, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, provider: "Google Gemini", model: env.GEMINI_MODEL || DEFAULT_MODEL }, 200, allowedOrigin);
    }

    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return json({ error: "Not found." }, 404, allowedOrigin);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "Worker setup incomplete: GEMINI_API_KEY secret is missing." }, 503, allowedOrigin);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request is too large." }, 413, allowedOrigin);

    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return json({ error: "Request is too large." }, 413, allowedOrigin);
      }
      body = JSON.parse(raw);
    } catch (_) {
      return json({ error: "Invalid JSON body." }, 400, allowedOrigin);
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      return json({ error: "messages must contain between 1 and 20 items." }, 400, allowedOrigin);
    }

    let systemText = "";
    const contents = [];
    for (const item of body.messages) {
      if (!item || !["system", "user", "assistant"].includes(item.role) || typeof item.content !== "string") {
        return json({ error: "Each message must have a valid role and text content." }, 400, allowedOrigin);
      }
      const content = item.content.trim();
      if (!content || content.length > MAX_MESSAGE_CHARS) {
        return json({ error: "Each message must be non-empty and no longer than 12000 characters." }, 400, allowedOrigin);
      }
      if (item.role === "system") {
        systemText = systemText ? systemText + "\n\n" + content : content;
      } else {
        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: content }]
        });
      }
    }

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return json({ error: "The final message must be from the user." }, 400, allowedOrigin);
    }

    const model = (env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(model)) {
      return json({ error: "Invalid GEMINI_MODEL configuration." }, 500, allowedOrigin);
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };
    if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };

    let upstream;
    try {
      upstream = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) + ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify(payload)
        }
      );
    } catch (_) {
      return json({ error: "Could not reach Google Gemini. Please try again." }, 502, allowedOrigin);
    }

    let result;
    try {
      result = await upstream.json();
    } catch (_) {
      return json({ error: "Google Gemini returned an unreadable response." }, 502, allowedOrigin);
    }

    if (!upstream.ok) {
      const googleMessage = result && result.error && result.error.message;
      const safeMessage = upstream.status === 429
        ? "Gemini free quota or rate limit reached. Please wait and try again."
        : upstream.status === 400
          ? "Gemini rejected the request. Check the selected model and API key."
          : "Gemini request failed. Check the Worker configuration.";
      return json({ error: safeMessage, providerStatus: upstream.status, detail: googleMessage || undefined }, upstream.status === 429 ? 429 : 502, allowedOrigin);
    }

    const answer = (result.candidates || [])
      .flatMap(candidate => (candidate.content && candidate.content.parts) || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) return json({ error: "Gemini returned no text. The response may have been blocked or empty." }, 502, allowedOrigin);
    return json({ reply: answer, model }, 200, allowedOrigin);
  }
};
