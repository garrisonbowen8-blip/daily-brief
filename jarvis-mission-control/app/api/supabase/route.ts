import { createClient } from "@supabase/supabase-js";
import { connectorError, notConnected } from "@/lib/connectors";

// Buddy Check pulse — READ-ONLY head-count queries against the live schema:
// profiles / daily_checkins / forum_posts / connections.
// Use the service-role key here (server-side only) so RLS doesn't zero out
// the counts; it must never be exposed to the client.

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return notConnected("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const count = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
      q.then(({ count, error }) => {
        if (error) throw new Error(error.message);
        return count ?? 0;
      });

    const [verifiedUsers, checkins24h, activeThreads, newMatches7d] = await Promise.all([
      count(
        db
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "verified")
          .is("deleted_at", null)
      ),
      count(
        db
          .from("daily_checkins")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dayAgo)
      ),
      count(
        db
          .from("forum_posts")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
      ),
      count(
        db
          .from("connections")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo)
      ),
    ]);

    return Response.json({
      connected: true,
      verifiedUsers,
      checkins24h,
      activeThreads,
      newMatches7d,
    });
  } catch (err) {
    return connectorError(err);
  }
}
