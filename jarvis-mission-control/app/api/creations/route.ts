import { loadCreations } from "@/lib/creations";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ creations: loadCreations() });
}
