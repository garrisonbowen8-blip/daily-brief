import { google } from "googleapis";
import { getGoogleAuth, connectorError } from "@/lib/connectors";
import { loadDismissed } from "@/lib/dismissed";

export const dynamic = "force-dynamic";

function header(h: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return h?.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET() {
  try {
    const { client } = getGoogleAuth();
    const gmail = google.gmail({ version: "v1", auth: client });

    // People-only filter: exclude automated senders, companies, and the
    // daily-brief self-mail, so the tile surfaces humans who need replies
    const peopleOnly = [
      "in:inbox is:unread",
      "-category:{promotions social updates forums}",
      "-from:(noreply OR no-reply OR donotreply OR do-not-reply)",
      "-from:(newsletter OR notifications OR automated OR mailer OR bounce OR postmaster)",
      "-from:(support@ OR help@ OR info@ OR admin@ OR billing@ OR hello@ OR team@ OR news@ OR updates@ OR alerts@ OR marketing@)",
      "-from:(daily-brief OR dailybrief OR gb2520@berkeley.edu)", // exclude own daily-brief mails
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

    const dismissed = loadDismissed();
    // second-pass heuristic: display names that read as companies, not people
    const looksLikePerson = (from: string) => {
      if (/no.?reply|newsletter|notification|automated|mailer|alert|billing|unsubscribe/i.test(from)) return false;
      if (/\b(llc|inc|corp|co\.|ltd|®|™)\b/i.test(from)) return false;
      const displayName = from.replace(/<[^>]+>/, "").trim();
      if (displayName === displayName.toUpperCase() && displayName.length > 3) return false;
      return true;
    };
    const keep = <T extends { id: string; from: string }>(arr: T[]) =>
      arr.filter((t) => !(t.id in dismissed) && looksLikePerson(t.from));

    const [threads, urgent] = await Promise.all([
      Promise.all((needsReplyRes.data.threads ?? []).map((t) => describe(t.id!))),
      Promise.all((urgentRes.data.threads ?? []).map((t) => describe(t.id!))),
    ]);

    return Response.json({
      connected: true,
      unread: unreadRes.data.threadsUnread ?? 0,
      threads: keep(threads),
      urgent: keep(urgent),
      dismissedCount: Object.keys(dismissed).length,
    });
  } catch (err) {
    return connectorError(err);
  }
}
