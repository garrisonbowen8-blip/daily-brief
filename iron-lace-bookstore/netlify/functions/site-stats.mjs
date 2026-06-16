// Owner-only API: returns Cloudflare Web Analytics visit stats for the dashboard.
//
// Security: responds only to a logged-in owner (Netlify Identity).
//
// Environment variables:
//   CF_API_TOKEN    - Cloudflare API token with analytics read              (required)
//   CF_SITE_TAG     - Web Analytics "site tag" (the beacon token)           (required)
//   CF_ACCOUNT_TAG  - Cloudflare account ID                                 (optional)

const GQL = "https://api.cloudflare.com/client/v4/graphql";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "auth_required", message: "Please log in." });

  const token = process.env.CF_API_TOKEN;
  const siteTag = process.env.CF_SITE_TAG;
  if (!token || !siteTag) return json(200, { configured: false });

  const cfFetch = (body) =>
    fetch(GQL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Diagnostic: verify the token so the error line can show whether the *new*
  // token is actually live (id + status) — ends the guessing about redeploys.
  let diag = "";
  try {
    const vr = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vb = await vr.json();
    const id = vb && vb.result && vb.result.id ? String(vb.result.id).slice(0, 6) : "?";
    const st = vb && vb.result && vb.result.status ? vb.result.status : vb && vb.success ? "ok" : "invalid";
    diag = "token " + st + " #" + id;
  } catch (_) {
    diag = "token verify failed";
  }
  // Does the token see the account at all (REST)? Distinguishes a scope problem
  // (restAccts 0) from a missing-analytics-permission problem (restAccts >=1).
  try {
    const ar = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=5", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ab = await ar.json();
    diag += " · restAccts " + (((ab && ab.result) || []).length);
  } catch (_) {
    diag += " · restAccts ?";
  }

  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days || "30", 10) || 30, 1), 90);
  const start = new Date(Date.now() - days * 86400000);
  const end = new Date();
  const dateGeq = start.toISOString().slice(0, 10);
  const dateLeq = end.toISOString().slice(0, 10);

  // Accounts to check: every account the token can see, plus an optional override.
  let candidates = [];
  try {
    const r = await cfFetch({ query: "query{ viewer { accounts { accountTag } } }" });
    const b = await r.json();
    if (b && b.errors && b.errors.length) {
      return json(200, { configured: true, ok: false, error: b.errors.map((e) => e.message).join("; ") + " — [" + diag + "]" });
    }
    candidates = ((b && b.data && b.data.viewer && b.data.viewer.accounts) || []).map((a) => a.accountTag);
  } catch (e) {
    return json(200, { configured: true, ok: false, error: String((e && e.message) || e) + " — [" + diag + "]" });
  }
  const accountsVisible = candidates.length;
  if (process.env.CF_ACCOUNT_TAG) candidates.push(process.env.CF_ACCOUNT_TAG);
  candidates = candidates.filter((v, i, a) => v && a.indexOf(v) === i);
  diag += " · accountsSeen " + accountsVisible;
  if (!candidates.length) {
    return json(200, { configured: true, ok: false, error: "No Cloudflare account is visible to this token — [" + diag + "]" });
  }

  const coreQuery = `
    query($accountTag:String!,$siteTag:String!,$dateGeq:Date!,$dateLeq:Date!){
      viewer{ accounts(filter:{accountTag:$accountTag}){
        totals: rumPageloadEventsAdaptiveGroups(limit:1, filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count sum{ visits } }
        series: rumPageloadEventsAdaptiveGroups(limit:1000, orderBy:[date_ASC], filter:{siteTag:$siteTag, date_geq:$dateGeq, date_leq:$dateLeq}){ count sum{ visits } dimensions{ date } }
      }}}`;

  const runCore = async (acct) => {
    const r = await cfFetch({ query: coreQuery, variables: { accountTag: acct, siteTag, dateGeq, dateLeq } });
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
    const r = await cfFetch({ query: bdQuery, variables: { accountTag: chosen, siteTag, dateGeq, dateLeq } });
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
