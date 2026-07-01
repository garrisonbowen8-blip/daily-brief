import { google } from "googleapis";
import { getGoogleAuth, connectorError } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { client } = getGoogleAuth();
    const cal = google.calendar({ version: "v3", auth: client });

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Pull from every calendar on the account — primary, shared (e.g. a
    // school calendar shared to this account), and subscribed ones alike.
    const list = await cal.calendarList.list({ maxResults: 20 });
    const calendarIds = (list.data.items ?? [])
      .filter((c) => c.selected !== false && c.id)
      .map((c) => c.id!);
    if (calendarIds.length === 0) calendarIds.push("primary");

    const results = await Promise.allSettled(
      calendarIds.map((calendarId) =>
        cal.events.list({
          calendarId,
          timeMin: now.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 10,
        })
      )
    );

    const events = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value.data.items ?? [] : []))
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: e.id,
        title: e.summary ?? "(untitled)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay: !e.start?.dateTime,
        location: e.location ?? null,
      }))
      // de-dupe events that appear on multiple calendars, then sort by time
      .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
      .sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? "")));

    // "free until" = start of the next timed event, if any
    const nextTimed = events.find((e) => !e.allDay);
    return Response.json({
      connected: true,
      events: events.slice(0, 3),
      allCount: events.length,
      freeUntil: nextTimed?.start ?? null,
    });
  } catch (err) {
    return connectorError(err);
  }
}
