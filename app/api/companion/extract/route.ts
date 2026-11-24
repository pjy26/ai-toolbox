import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// Older clients call this after each reply. Completed turns already have a durable job.
export async function POST() {
  if (!(await getAuthUser()))
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ ok: true, note: "server_managed" });
}
