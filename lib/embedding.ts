// Embedding 工具：OpenAI 兼容端点（默认硅基流动 SiliconFlow，DeepSeek 没有 embedding 能力）
// 独立环境变量 EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL，不复用 OPENAI_*
// 模型 Qwen/Qwen3-Embedding-0.6B（免费，1024 维），失败静默返回 null——
// embedding 是增强能力，绝不能拖垮聊天主链路

const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
// bge-large-zh-v1.5：硅基流动官方无条件免费模型（千问 0.6B 的免费额度按区域给，海外 IP 会 402）
// 1024 维，与数据库 vector(1024) 绑定——换模型必须同维度，否则向量空间混乱、检索全废
const DEFAULT_MODEL = "BAAI/bge-large-zh-v1.5";

export function getEmbeddingConfig(): { baseURL: string; model: string } {
  return {
    baseURL: (process.env.EMBEDDING_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    // 模型在代码里锁死，不走环境变量：向量空间一致性是硬约束，
    // env 改模型容易把不同模型的向量混进同一列，检索直接报废
    model: DEFAULT_MODEL,
  };
}

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
  const model = DEFAULT_MODEL; // 模型锁死（见 getEmbeddingConfig 注释）

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
