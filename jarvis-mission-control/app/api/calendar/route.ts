import { google } from "googleapis";
import { getGoogleAuth, connectorError } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { client, calendarId } = getGoogleAuth();
    const cal = google.calendar({ version: "v3", auth: client });

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await cal.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 10,
    });

    const events = (res.data.items ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: e.id,
        title: e.summary ?? "(untitled)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay: !e.start?.dateTime,
        location: e.location ?? null,
      }));

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
