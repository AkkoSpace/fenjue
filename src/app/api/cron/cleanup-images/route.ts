import { type NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron/auth";
import { cleanupPendingImageUploads } from "@/lib/uploads/cleanup";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await cleanupPendingImageUploads(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "Image cleanup job failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Image cleanup job failed" },
      { status: 500 },
    );
  }
}
