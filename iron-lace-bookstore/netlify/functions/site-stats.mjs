// Owner-only API: returns Cloudflare Web Analytics visit stats for the dashboard.
//
// Security: responds only to a logged-in owner (Netlify Identity).
//
// Environment variables:
//   CF_API_TOKEN    - Cloudflare API token with Account Analytics: Read   (required)
//   CF_SITE_TAG     - Web Analytics "site tag" (the beacon token)         (required)
//   CF_ACCOUNT_TAG  - Cloudflare account ID                               (optional)

const GQL = "https://api.cloudflare.com/client/v4/graphql";
const REST = "https://api.cloudflare.com/client/v4";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "auth_required", message: "Please log in." });

  const token = process.env.CF_API_TOKEN;
  const siteTag = process.env.CF_SITE_TAG;
  if (!token || !siteTag) return json(200, { configured: false });

  const authHeaders = { Authorization: `Bearer ${token}` };
  const cfGraph = (body) =>
    fetch(GQL, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // Token diagnostic (helps confirm the live token).
  let diag = "";
  try {
    const vr = await fetch(`${REST}/user/tokens/verify`, { headers: authHeaders });
    const vb = await vr.json();
    const id = vb && vb.result && vb.result.id ? String(vb.result.id).slice(0, 6) : "?";
    const st = vb && vb.result && vb.result.status ? vb.result.status : vb && vb.success ? "ok" : "invalid";
    diag = "token " + st + " #" + id;
  } catch (_) {
    diag = "token verify failed";
  }

  // Get account IDs the reliable way — the REST accounts endpoint — instead of
  // the GraphQL `viewer { accounts }` enumeration (which can return
  // "not authorized" even when a direct, filtered query works fine).
  let candidates = [];
  try {
    const ar = await fetch(`${REST}/accounts?per_page=50`, { headers: authHeaders });
    const ab = await ar.json();
    if ((!ab || ab.success === false) && ab && ab.errors && ab.errors.length) {
      return json(200, { configured: true, ok: false, error: ab.errors.map((e) => e.message).join("; ") + " — [" + diag + "]" });
    }
    candidates = ((ab && ab.result) || []).map((a) => a.id);
  } catch (e) {
    return json(200, { configured: true, ok: false, error: String((e && e.message) || e) + " — [" + diag + "]" });
  }
  diag += " · accts " + candidates.length;
  if (process.env.CF_ACCOUNT_TAG) candidates.push(process.env.CF_ACCOUNT_TAG);
  candidates = candidates.filter((v, i, a) => v && a.indexOf(v) === i);
  if (!candidates.length) {
    return json(200, { configured: true, ok: false, error: "No Cloudflare account is visible to this token — [" + diag + "]" });
  }

  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days || "30", 10) || 30, 1), 90);
  const start = new Date(Date.now() - days * 86400000);
  const dateGeq = start.toISOString().slice(0, 10);
  const dateLeq = new Date().toISOString().slice(0, 10);

  const coreQuery = `
    query($accountTag:String!,$siteTag:String!,$dateGeq:Date!,$dateLeq:Date!){
      viewer{ accounts(filter:{accountTag:$accountTag}){
        totals: rumPageloadEventsAdaptiveGroups(limit:1, filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count sum{ visits } }
        series: rumPageloadEventsAdaptiveGroups(limit:1000, orderBy:[date_ASC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count sum{ visits } dimensions{ date } }
      }}}`;

  const runCore = async (acct) => {
    const r = await cfGraph({ query: coreQuery, variables: { accountTag: acct, siteTag, dateGeq, dateLeq } });
    const b = await r.json();
    if (b && b.errors && b.errors.length) throw new Error(b.errors.map((e) => e.message).join("; "));
    return (b && b.data && b.data.viewer && b.data.viewer.accounts && b.data.viewer.accounts[0]) || {};
  };

  let chosen = null, chosenData = null, lastErr = null;
  for (const acct of candidates) {
    try {
      const a = await runCore(acct);
      const totals = (a.totals && a.totals[0]) || { count: 0, sum: { visits: 0 } };
      const series = a.series || [];
      if (!chosenData) { chosen = acct; chosenData = { totals, series }; }
      if ((totals.count || 0) > 0 || series.length > 0) { chosen = acct; chosenData = { totals, series }; break; }
    } catch (e) { lastErr = e; }
  }
  if (!chosenData) {
    return json(200, { configured: true, ok: false, error: String((lastErr && lastErr.message) || "No data from Cloudflare.") + " — [" + diag + "]" });
  }

  const totals = chosenData.totals;
  const series = chosenData.series.map((r) => ({
    date: r.dimensions.date,
    pageviews: r.count,
    visits: (r.sum && r.sum.visits) || 0,
  }));

  let topPaths = [], topReferers = [];
  try {
    const bdQuery = `
      query($accountTag:String!,$siteTag:String!,$dateGeq:Date!,$dateLeq:Date!){
        viewer{ accounts(filter:{accountTag:$accountTag}){
          topPaths: rumPageloadEventsAdaptiveGroups(limit:8, orderBy:[count_DESC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count dimensions{ requestPath } }
          topReferers: rumPageloadEventsAdaptiveGroups(limit:8, orderBy:[count_DESC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count dimensions{ refererHost } }
        }}}`;
    const r = await cfGraph({ query: bdQuery, variables: { accountTag: chosen, siteTag, dateGeq, dateLeq } });
    const b = await r.json();
    const a = (b && b.data && b.data.viewer && b.data.viewer.accounts && b.data.viewer.accounts[0]) || {};
    topPaths = (a.topPaths || []).map((r) => ({ path: r.dimensions.requestPath, count: r.count }));
    topReferers = (a.topReferers || []).map((r) => ({ host: r.dimensions.refererHost || "Direct / none", count: r.count }));
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
};

function json(statusCode, body, noStore) {
  const headers = { "Content-Type": "application/json" };
  if (noStore) headers["Cache-Control"] = "no-store";
  return { statusCode, headers, body: JSON.stringify(body) };
}
