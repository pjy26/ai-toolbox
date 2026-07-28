// 语义检索：embedding + pgvector 混合排序（w1·importance + w2·cosine + w3·recency）
// 两个独立检索：事实型记忆 top 6 + 经历型记忆 top 3，不合并
// 返回 null 表示走降级路径（调用方退回 importance 排序旧逻辑）

import { embedText } from "./embedding";

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

/**
 * 语义检索记忆。返回 null → 调用方走降级（importance 排序）。
 * 触发降级的三种情况：消息太短 / embedding 超时或失败 / 两个查询都报错。
 */
export async function semanticRecall(
  supabase: any,
  companionId: string,
  queryText: string
): Promise<RecallResult | null> {
  if (!queryText || queryText.trim().length < SHORT_MESSAGE_THRESHOLD) return null;

  const embedding = await embedText(queryText, MAIN_TIMEOUT_MS);
  if (!embedding) return null;

  const common = {
    p_companion_id: companionId,
    p_query_embedding: embedding,
    p_w_importance: RETRIEVAL_PARAMS.wImportance,
    p_w_cosine: RETRIEVAL_PARAMS.wCosine,
    p_w_recency: RETRIEVAL_PARAMS.wRecency,
    p_half_life_days: RETRIEVAL_PARAMS.halfLifeDays,
  };

  const [mem, ev] = await Promise.all([
    supabase.rpc("match_memory_summaries", { ...common, p_limit: RETRIEVAL_PARAMS.memoryTopK }),
    supabase.rpc("match_relationship_events", { ...common, p_limit: RETRIEVAL_PARAMS.eventTopK }),
  ]);

  if (mem.error) console.error("match_memory_summaries 检索失败:", mem.error.message);
  if (ev.error) console.error("match_relationship_events 检索失败:", ev.error.message);
  if (mem.error && ev.error) return null;

  return {
    memories: (mem.data as MemoryHit[]) || [],
    events: (ev.data as EventHit[]) || [],
  };
}
