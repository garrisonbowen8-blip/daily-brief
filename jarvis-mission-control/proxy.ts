import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/mobile", request.url));
  }
}

export const config = { matcher: "/" };
