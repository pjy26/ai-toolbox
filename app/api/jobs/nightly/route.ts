import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runNightlyJobs } from "@/lib/dream-nightly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(req: Request): { ok: boolean; configured: boolean } {
  const cronSecret = process.env.CRON_SECRET;
  const nightlyToken = process.env.NIGHTLY_JOB_TOKEN;
  const accepted = [cronSecret, nightlyToken].filter((value): value is string => Boolean(value));
  if (accepted.length === 0) return { ok: false, configured: false };

  const authorization = req.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const provided = [
    bearer,
    req.headers.get("x-cron-secret"),
    req.headers.get("x-nightly-job-token"),
  ].filter((value): value is string => Boolean(value));

  return {
    ok: provided.some((value) => accepted.some((secret) => secretMatches(value, secret))),
    configured: true,
  };
}

async function run(req: Request) {
  const auth = authorize(req);
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
