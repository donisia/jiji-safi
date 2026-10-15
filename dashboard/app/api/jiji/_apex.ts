// Server-only helper. Oracle's free APEX blocks plain script traffic, so we go through
// the bot (python app.py), which forwards to APEX using a Chrome-style connection.
export const APEX_BASE = (
  process.env.APEX_BASE_URL ?? "http://127.0.0.1:5000/apex"
).replace(/\/$/, "");

export async function forward(path: string, init?: RequestInit) {
  try {
    const r = await fetch(`${APEX_BASE}${path}`, { cache: "no-store", ...init });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch (e: any) {
    return Response.json({ error: "APEX unreachable", detail: String(e) }, { status: 502 });
  }
}
