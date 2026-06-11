import { notConnected, connectorError } from "@/lib/connectors";

// Porter Metrics — social/content stats (posts 24h & 7d by platform, reach,
// engagement). Porter is exposed to this app as a remote MCP server: set
// PORTER_MCP_URL and PORTER_MCP_TOKEN in .env.local to wire it. Until then
// the tile shows "not connected" — no faked numbers.
//
// NOTE: Blotato is NOT connected. Do not add Blotato data here.

export const dynamic = "force-dynamic";

async function mcpCall(url: string, token: string, method: string, params: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Porter MCP ${res.status}`);
  const text = await res.text();
  // Streamable HTTP may answer as SSE; take the last data: line if so.
  const payload = text.startsWith("event:") || text.includes("\ndata:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).at(-1)?.slice(5)
    : text;
  return JSON.parse(payload ?? "{}");
}

export async function GET() {
  const url = process.env.PORTER_MCP_URL;
  const token = process.env.PORTER_MCP_TOKEN;
  if (!url || !token) {
    return notConnected(
      "Set PORTER_MCP_URL and PORTER_MCP_TOKEN in .env.local to pull post counts, reach and engagement"
    );
  }

  try {
    // Porter's portal exposes a `search` + `execute` flow; the exact query is
    // configurable so the report can be tuned without a redeploy.
    const result = await mcpCall(url, token, "tools/call", {
      name: process.env.PORTER_TOOL ?? "fetch",
      arguments: JSON.parse(
        process.env.PORTER_QUERY ??
          '{"report":"social_overview","ranges":["last_24h","last_7d"]}'
      ),
    });
    return Response.json({ connected: true, result: result.result ?? result });
  } catch (err) {
    return connectorError(err);
  }
}
