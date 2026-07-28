import { NextResponse } from "next/server";
import { createServerAdminClient } from "@/lib/supabase";
import { embedText, getLastEmbeddingError, getEmbeddingConfig } from "@/lib/embedding";

// 一次性回填脚本（部署在 Vercel 上跑——本地网络可能到不了 embedding 端点）
// 遍历 memory_summaries / relationship_events 中 embedding 为 NULL 的行，逐条补 embedding
// 几十条数据顺序跑，不用分批限流
// 用法：POST /api/admin/backfill-embeddings?token=<BACKFILL_TOKEN>

export const maxDuration = 300;

const EMBED_TIMEOUT_MS = 5000;

async function backfillTable(
  supabase: any,
  table: string,
  textColumn: string
): Promise<{ total: number; embedded: number; failed: number }> {
  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${textColumn}`)
    .is("embedding", null)
    .limit(200);
  if (error) {
    console.error(`backfill 读取 ${table} 失败:`, error.message);
    return { total: 0, embedded: 0, failed: -1 };
  }

  let embedded = 0;
  let failed = 0;
  for (const row of rows || []) {
    const text = row[textColumn];
    if (!text || typeof text !== "string") {
      failed++;
      continue;
    }
    const embedding = await embedText(text, EMBED_TIMEOUT_MS);
    if (!embedding) {
      failed++;
      continue;
    }
    const { error: upErr } = await supabase
      .from(table)
      .update({ embedding })
      .eq("id", row.id);
    if (upErr) {
      console.error(`backfill 更新 ${table}#${row.id} 失败:`, upErr.message);
      failed++;
    } else {
      embedded++;
    }
  }
  return { total: (rows || []).length, embedded, failed };
}

export async function POST(req: Request) {
  const token =
    new URL(req.url).searchParams.get("token") || req.headers.get("x-backfill-token");
  if (!process.env.BACKFILL_TOKEN || token !== process.env.BACKFILL_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerAdminClient();
  const [summaries, events] = [
    await backfillTable(supabase, "memory_summaries", "summary"),
    await backfillTable(supabase, "relationship_events", "description"),
  ];

  return NextResponse.json({
    ok: true,
    memory_summaries: summaries,
    relationship_events: events,
    embeddingConfig: getEmbeddingConfig(),
    lastEmbeddingError: getLastEmbeddingError(),
  });
}
