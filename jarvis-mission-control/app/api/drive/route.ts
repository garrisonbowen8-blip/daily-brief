import { google } from "googleapis";
import { getGoogleAuth, connectorError } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { client } = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth: client });

    const res = await drive.files.list({
      orderBy: "modifiedTime desc",
      pageSize: 5,
      q: "trashed = false",
      fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
    });

    return Response.json({
      connected: true,
      files: (res.data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        link: f.webViewLink,
      })),
    });
  } catch (err) {
    return connectorError(err);
  }
}
