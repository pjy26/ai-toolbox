// Embedding 工具：OpenAI 兼容端点（默认硅基流动 SiliconFlow，DeepSeek 没有 embedding 能力）
// 独立环境变量 EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL，不复用 OPENAI_*
// 模型 Qwen/Qwen3-Embedding-0.6B（免费，1024 维），失败静默返回 null——
// embedding 是增强能力，绝不能拖垮聊天主链路

const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B";

// 诊断用：记录最近一次失败原因（回填/排查时读取，不影响主链路）
let lastError: string | null = null;
export function getLastEmbeddingError(): string | null {
  return lastError;
}

export async function embedText(text: string, timeoutMs = 2000): Promise<number[] | null> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey || !text?.trim()) {
    lastError = !apiKey ? "EMBEDDING_API_KEY 未配置" : "空文本";
    return null;
  }

  const baseURL = (process.env.EMBEDDING_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: text.trim().slice(0, 2000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      lastError = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
      console.error("embedding 调用失败:", lastError);
      return null;
    }
    const json = await res.json();
    const vec = json?.data?.[0]?.embedding;
    if (Array.isArray(vec) && vec.length > 0) {
      lastError = null;
      return vec;
    }
    lastError = "响应无 embedding 数据: " + JSON.stringify(json).slice(0, 200);
    return null;
  } catch (err: any) {
    // 超时（AbortError）或网络错误都静默降级
    lastError = err?.name === "AbortError" ? `超时(${timeoutMs}ms)` : `网络错误: ${err?.message || err}`;
    if (err?.name !== "AbortError") console.error("embedding 异常:", err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
