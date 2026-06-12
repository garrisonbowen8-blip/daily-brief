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

    const [unreadRes, needsReplyRes, urgentRes] = await Promise.all([
      gmail.users.labels.get({ userId: "me", id: "INBOX" }),
      gmail.users.threads.list({
        userId: "me",
        q: "in:inbox is:unread -category:{promotions social updates forums}",
        maxResults: 5,
      }),
      gmail.users.threads.list({
        userId: "me",
        q: "in:inbox is:unread (is:starred OR is:important subject:(urgent OR asap OR deadline))",
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
    const keep = <T extends { id: string }>(arr: T[]) =>
      arr.filter((t) => !(t.id in dismissed));

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
