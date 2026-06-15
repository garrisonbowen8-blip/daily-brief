// Owner-only API: returns Cloudflare Web Analytics visit stats for the dashboard.
//
// Security: responds only to a logged-in owner (Netlify Identity), same as the
// prayer-requests function.
//
// Optional environment variables. If any are missing the function returns
// { configured:false } and the dashboard simply shows a "connect Cloudflare"
// prompt instead of visit numbers:
//   CF_API_TOKEN    - Cloudflare API token with "Account Analytics: Read"
//   CF_ACCOUNT_TAG  - Cloudflare account ID
//   CF_SITE_TAG     - Web Analytics "site tag" (from the beacon snippet)

const GQL = "https://api.cloudflare.com/client/v4/graphql";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "auth_required", message: "Please log in." });

  const token = process.env.CF_API_TOKEN;
  const accountTag = process.env.CF_ACCOUNT_TAG;
  const siteTag = process.env.CF_SITE_TAG;
  if (!token || !accountTag || !siteTag) return json(200, { configured: false });

  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days || "30", 10) || 30, 1), 90);
  const start = new Date(Date.now() - days * 86400000);
  const end = new Date();
  const vars = {
    accountTag,
    siteTag,
    start: start.toISOString(),
    end: end.toISOString(),
    dateGeq: start.toISOString().slice(0, 10),
    dateLeq: end.toISOString().slice(0, 10),
  };

  const run = async (query) => {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: vars }),
    });
    const body = await res.json();
    if (body.errors && body.errors.length) {
      throw new Error(body.errors.map((e) => e.message).join("; "));
    }
    return body.data?.viewer?.accounts?.[0] || {};
  };

  // Core query: totals + per-day series (high-confidence fields).
  const coreQuery = `
    query($accountTag:String!,$siteTag:String!,$start:Time!,$end:Time!,$dateGeq:Date!,$dateLeq:Date!){
      viewer{ accounts(filter:{accountTag:$accountTag}){
        totals: rumPageloadEventsAdaptiveGroups(limit:1, filter:{siteTag:$siteTag, datetime_geq:$start, datetime_leq:$end}){
          count sum{ visits }
        }
        series: rumPageloadEventsAdaptiveGroups(limit:1000, orderBy:[date_ASC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){
          count sum{ visits } dimensions{ date }
        }
      }}}`;

  // Breakdown query: top pages + referrers (kept separate so a field-name
  // mismatch here can't wipe out the core numbers).
  const breakdownQuery = `
    query($accountTag:String!,$siteTag:String!,$dateGeq:Date!,$dateLeq:Date!){
      viewer{ accounts(filter:{accountTag:$accountTag}){
        topPaths: rumPageloadEventsAdaptiveGroups(limit:8, orderBy:[count_DESC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){
          count dimensions{ requestPath }
        }
        topReferers: rumPageloadEventsAdaptiveGroups(limit:8, orderBy:[count_DESC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){
          count dimensions{ refererHost }
        }
      }}}`;

  try {
    const core = await run(coreQuery);
    const totals = (core.totals && core.totals[0]) || { count: 0, sum: { visits: 0 } };
    const series = (core.series || []).map((r) => ({
      date: r.dimensions.date,
      pageviews: r.count,
      visits: (r.sum && r.sum.visits) || 0,
    }));

    let topPaths = [];
    let topReferers = [];
    try {
      const bd = await run(breakdownQuery);
      topPaths = (bd.topPaths || []).map((r) => ({ path: r.dimensions.requestPath, count: r.count }));
      topReferers = (bd.topReferers || []).map((r) => ({
        host: r.dimensions.refererHost || "Direct / none",
        count: r.count,
      }));
    } catch (_) {
      /* breakdown is best-effort */
    }

    return json(
      200,
      {
        configured: true,
        ok: true,
        days,
        pageviews: totals.count || 0,
        visits: (totals.sum && totals.sum.visits) || 0,
        series,
        topPaths,
        topReferers,
      },
      true
    );
  } catch (e) {
    return json(200, { configured: true, ok: false, error: String((e && e.message) || e) });
  }
};

function json(statusCode, body, noStore) {
  const headers = { "Content-Type": "application/json" };
  if (noStore) headers["Cache-Control"] = "no-store";
  return { statusCode, headers, body: JSON.stringify(body) };
}
