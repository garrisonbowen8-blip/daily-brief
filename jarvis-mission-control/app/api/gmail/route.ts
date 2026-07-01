import { google } from "googleapis";
import { getGoogleAuth, connectorError } from "@/lib/connectors";

export const dynamic = "force-dynamic";

function header(h: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return h?.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET() {
  try {
    const { client } = getGoogleAuth();
    const gmail = google.gmail({ version: "v1", auth: client });

    // People-only filter: exclude automated senders, companies, and daily brief
    const peopleOnly = [
      "in:inbox is:unread",
      "-category:{promotions social updates forums}",
      "-from:(noreply OR no-reply OR donotreply OR do-not-reply)",
      "-from:(newsletter OR notifications? OR automated OR mailer OR bounce OR postmaster)",
      "-from:(support@ OR help@ OR info@ OR admin@ OR billing@ OR hello@ OR team@ OR news@ OR updates@ OR alerts@ OR marketing@)",
      "-from:(daily-brief OR dailybrief OR gb2520@berkeley.edu)",  // exclude own daily brief
    ].join(" ");

    const [unreadRes, needsReplyRes, urgentRes] = await Promise.all([
      gmail.users.labels.get({ userId: "me", id: "INBOX" }),
      gmail.users.threads.list({
        userId: "me",
        q: peopleOnly,
        maxResults: 6,
      }),
      gmail.users.threads.list({
        userId: "me",
        q: `${peopleOnly} (is:starred OR is:important OR subject:(urgent OR asap OR deadline))`,
        maxResults: 3,
      }),
    ]);

    const describe = async (threadId: string) => {
      const t = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const msg = t.data.messages?.at(-1);
      return {
        id: threadId,
        subject: header(msg?.payload?.headers ?? undefined, "Subject") || "(no subject)",
        from: header(msg?.payload?.headers ?? undefined, "From").replace(/<.*>/, "").trim(),
        snippet: msg?.snippet ?? "",
      };
    };

    const looksLikePerson = (from: string) => {
      const lower = from.toLowerCase();
      if (/no.?reply|newsletter|notification|automated|mailer|alert|billing|unsubscribe/i.test(lower)) return false;
      // Company names are usually all-caps or contain LLC/Inc/Co/Corp/®
      if (/\b(llc|inc|corp|co\.|ltd|®|™)\b/i.test(from)) return false;
      // If display name is ALL CAPS it's likely a company
      const displayName = from.replace(/<[^>]+>/, "").trim();
      if (displayName === displayName.toUpperCase() && displayName.length > 3) return false;
      return true;
    };

    const [allThreads, allUrgent] = await Promise.all([
      Promise.all((needsReplyRes.data.threads ?? []).map((t) => describe(t.id!))),
      Promise.all((urgentRes.data.threads ?? []).map((t) => describe(t.id!))),
    ]);

    const threads = allThreads.filter(t => looksLikePerson(t.from));
    const urgent = allUrgent.filter(t => looksLikePerson(t.from));

    return Response.json({
      connected: true,
      unread: unreadRes.data.threadsUnread ?? 0,
      threads,
      urgent,
    });
  } catch (err) {
    return connectorError(err);
  }
}
