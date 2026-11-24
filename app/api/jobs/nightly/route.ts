import { NextResponse } from "next/server";
import { authorizedJob } from "@/lib/job-auth";
import { runNightlyJobs } from "@/lib/dream-nightly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const auth = authorizedJob(req);
  if (!auth.configured) {
    return NextResponse.json({ error: "夜间任务未配置凭证" }, { status: 503 });
  }
  if (!auth.ok) return NextResponse.json({ error: "未授权" }, { status: 401 });

  try {
    const summary = await runNightlyJobs();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[nightly] scheduler failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "夜间任务执行失败" }, { status: 500 });
  }
}

// Vercel and similar platforms invoke cron routes with GET.
export async function GET(req: Request) {
  return run(req);
}

// POST is available for protected internal/manual invocation.
export async function POST(req: Request) {
  return run(req);
}
