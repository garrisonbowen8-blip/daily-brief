// Owner-only API: returns prayer-request submissions for the dashboard.
//
// Security: this function ONLY responds to a logged-in site owner. Netlify
// validates the Netlify Identity token sent by the dashboard and fills in
// context.clientContext.user. No token -> 401, so prayer requests (which are
// private and personal) are never exposed publicly.
//
// Required environment variables (set in Netlify -> Site configuration ->
// Environment variables):
//   NETLIFY_API_TOKEN  - a Netlify personal access token (User settings ->
//                        Applications -> Personal access tokens)
//   SITE_ID            - this site's API ID (Site configuration -> General ->
//                        Site information -> Site ID)

const API = "https://api.netlify.com/api/v1";

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "auth_required", message: "Please log in." });

  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  if (!token) return json(200, { setup: "missing_token" });
  if (!siteId) return json(200, { setup: "missing_site" });

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  try {
    // 1) Find the prayer-request form and its id.
    const formsRes = await fetch(`${API}/sites/${siteId}/forms`, auth);
    if (!formsRes.ok) {
      return json(200, { error: "forms_fetch_failed", status: formsRes.status });
    }
    const forms = await formsRes.json();
    const form =
      forms.find((f) => f.name === "prayer-request") ||
      forms.find((f) => /prayer/i.test(f.name || ""));
    if (!form) {
      return json(200, {
        total: 0,
        thisMonth: 0,
        items: [],
        note: "No prayer-request form detected yet. Submit one test request, then check back.",
      });
    }

    // 2) Pull the most recent submissions.
    const subsRes = await fetch(
      `${API}/forms/${form.id}/submissions?per_page=100`,
      auth
    );
    if (!subsRes.ok) {
      return json(200, { error: "submissions_fetch_failed", status: subsRes.status });
    }
    const subs = await subsRes.json();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let thisMonth = 0;

    const items = subs.map((s) => {
      const d = s.data || {};
      const created = s.created_at || null;
      if (created && new Date(created) >= monthStart) thisMonth++;
      const name = (d.name && String(d.name).trim()) || "";
      return {
        message: d.message || "",
        name: name || "Anonymous",
        contact: d.contact || "",
        created_at: created,
      };
    });

    return json(
      200,
      {
        total: typeof form.submission_count === "number" ? form.submission_count : items.length,
        thisMonth,
        items,
      },
      true
    );
  } catch (e) {
    return json(200, { error: "upstream_error", message: String((e && e.message) || e) });
  }
};

function json(statusCode, body, noStore) {
  const headers = { "Content-Type": "application/json" };
  if (noStore) headers["Cache-Control"] = "no-store";
  return { statusCode, headers, body: JSON.stringify(body) };
}
