import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generateLetterForCompanion } from "@/lib/letter-generation";
import { getLetterMilestone } from "@/lib/letter-policy";

export const dynamic = "force-dynamic";

const COMPANION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorized(req: Request): boolean {
  const expected = process.env.LETTER_GENERATION_TOKEN;
  if (!expected) return false;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/** Internal/manual generation only. No browser session or user-facing button can invoke it. */
export async function POST(req: Request) {
  if (!process.env.LETTER_GENERATION_TOKEN) {
    return NextResponse.json({ error: "信件生成尚未启用" }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });

  let body: { companion_id?: unknown; milestone_key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (typeof body.companion_id !== "string" || !COMPANION_ID.test(body.companion_id)) {
    return NextResponse.json({ error: "角色 ID 无效" }, { status: 400 });
  }
  if (typeof body.milestone_key !== "string" || !getLetterMilestone(body.milestone_key)) {
    return NextResponse.json({ error: "信件里程碑无效" }, { status: 400 });
  }

  try {
    const result = await generateLetterForCompanion(body.companion_id, body.milestone_key);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown letter generation error";
    if (message === "Companion not found") return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    console.error("[letters] protected generation failed", message);
    return NextResponse.json({ error: "信件生成失败" }, { status: 500 });
  }
}
