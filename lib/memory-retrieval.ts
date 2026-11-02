// 语义检索：embedding + pgvector 混合排序（w1·importance + w2·cosine + w3·recency）
// 两个独立检索：事实型记忆 top 6 + 经历型记忆 top 3，不合并
// 返回 null 表示走降级路径（调用方退回 importance 排序旧逻辑）

import { embedText } from "./embedding";
import { dedupeMemoryEntries, isExpiredTransientMemory } from "./memory-reliability";

// 初始权重（拍的初始值，留作可调参数，后面用真实数据回灌调）
export const RETRIEVAL_PARAMS = {
  wImportance: 0.3,
  wCosine: 0.5,
  wRecency: 0.2,
  halfLifeDays: 30, // recency 30 天半衰期指数衰减
  memoryTopK: 6,
  eventTopK: 3,
};

// 用户消息 < 8 字（"嗯""好的"这种）跳过 embedding 检索，省一次 API 往返
export const SHORT_MESSAGE_THRESHOLD = 8;

// 主链路 embedding 超时：宁可降级也不能拖垮聊天首 token
export const MAIN_TIMEOUT_MS = 2000;

export interface MemoryHit {
  id: string;
  summary: string;
  importance: number;
  updated_at: string;
  score: number;
}

export interface EventHit {
  id: string;
  description: string;
  event_type: string | null;
  importance: number;
  occurred_at: string;
  score: number;
}

export interface RecallResult {
  memories: MemoryHit[];
  events: EventHit[];
}

export interface SemanticRecallOptions {
  now?: Date;
  // 测试注入用；生产调用方仍使用原来的三个参数，不触发额外服务。
  embed?: typeof embedText;
}

function byRank<T extends { score: number; importance: number }>(a: T, b: T): number {
  const scoreDelta = (Number.isFinite(b.score) ? b.score : -Infinity) -
    (Number.isFinite(a.score) ? a.score : -Infinity);
  return scoreDelta || (Number(b.importance) || 0) - (Number(a.importance) || 0);
}

/**
 * 语义检索记忆。返回 null → 调用方走降级（importance 排序）。
 * 先过量召回再按混合分数去重，避免近似重复挤占重要且相关的结果。
 */
export async function semanticRecall(
  supabase: any,
  companionId: string,
  queryText: string,
  options: SemanticRecallOptions = {},
): Promise<RecallResult | null> {
  if (!queryText || queryText.trim().length < SHORT_MESSAGE_THRESHOLD) {
    console.info("[memory-recall]", { companionId, path: "fallback", reason: "short_message" });
    return null;
  }

  let embedding: number[] | null;
  try {
    embedding = await (options.embed || embedText)(queryText, MAIN_TIMEOUT_MS);
  } catch {
    embedding = null;
  }
  if (!embedding) {
    console.info("[memory-recall]", { companionId, path: "fallback", reason: "embedding_unavailable" });
    return null;
  }

  const common = {
    p_companion_id: companionId,
    p_query_embedding: embedding,
    p_w_importance: RETRIEVAL_PARAMS.wImportance,
    p_w_cosine: RETRIEVAL_PARAMS.wCosine,
    p_w_recency: RETRIEVAL_PARAMS.wRecency,
    p_half_life_days: RETRIEVAL_PARAMS.halfLifeDays,
  };

  // Promise.reject 或 Supabase 同步异常都只影响检索，不应冒泡中断聊天。
  const [memResult, eventResult] = await Promise.allSettled([
    Promise.resolve().then(() => supabase.rpc("match_memory_summaries", {
      ...common,
      p_limit: RETRIEVAL_PARAMS.memoryTopK * 3,
    })),
    Promise.resolve().then(() => supabase.rpc("match_relationship_events", {
      ...common,
      p_limit: RETRIEVAL_PARAMS.eventTopK * 3,
    })),
  ]);
  const mem = memResult.status === "fulfilled"
    ? memResult.value
    : { data: null, error: memResult.reason };
  const ev = eventResult.status === "fulfilled"
    ? eventResult.value
    : { data: null, error: eventResult.reason };

  if (mem.error) console.error("match_memory_summaries 检索失败:", mem.error.message || "unknown");
  if (ev.error) console.error("match_relationship_events 检索失败:", ev.error.message || "unknown");
  if (mem.error && ev.error) return null;

  const now = options.now || new Date();
  const rankedMemories = ((mem.data as MemoryHit[] | null) || []).slice().sort(byRank);
  const rankedEvents = ((ev.data as EventHit[] | null) || []).slice().sort(byRank);
  const memories = dedupeMemoryEntries(
    rankedMemories,
    (memory) => memory.summary,
    (memory) => isExpiredTransientMemory(memory.summary, memory.updated_at, now),
  ).slice(0, RETRIEVAL_PARAMS.memoryTopK);
  const events = dedupeMemoryEntries(rankedEvents, (event) => event.description)
    .slice(0, RETRIEVAL_PARAMS.eventTopK);

  // 只记录 ID、数量和分数，不把用户消息或记忆正文写入日志。
  console.info("[memory-recall]", {
    companionId,
    path: "semantic",
    queryLength: queryText.trim().length,
    memories: memories.map((m) => ({ id: m.id, score: m.score })),
    events: events.map((e) => ({ id: e.id, score: e.score })),
  });

  return { memories, events };
}
