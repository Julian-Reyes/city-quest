const ALLOWED_ORIGINS = [
  "https://julian-reyes.github.io",
  "http://localhost:5174",
  "http://localhost:5173",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = { ...CORS_HEADERS };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(request, env) {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    // Only allow GET
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Forward to Foursquare
    const url = new URL(request.url);
    const foursquareUrl = `https://places-api.foursquare.com${url.pathname}${url.search}`;

    const response = await fetch(foursquareUrl, {
      headers: {
        Authorization: `Bearer ${env.FSQ_API_KEY}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });

    // Return with CORS headers
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(request),
      },
    });
  },
};
