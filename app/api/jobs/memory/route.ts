import { NextResponse } from "next/server";
import { authorizedJob } from "@/lib/job-auth";
import { processMemoryTurn } from "@/lib/memory-worker";

export const maxDuration = 60;
export async function POST(req: Request) {
  if (!authorizedJob(req).ok)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  let processed = 0,
    failed = 0;
  while (processed + failed < 12 && Date.now() - started < 26000) {
    const state = await processMemoryTurn();
    if (state === "idle" || state === "deferred") break;
    if (state === "done") processed++;
    else failed++;
  }
  return NextResponse.json(
    { processed, failed },
    { status: failed ? 503 : 200 },
  );
}
