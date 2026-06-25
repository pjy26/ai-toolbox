"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, RotateCcw, Heart } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CompanionConfig {
  companion_gender: string;
  nickname: string;
  user_profile: string;
  memory_summaries: string;
}

export default function CompanionPage() {
  const [config, setConfig] = useState<CompanionConfig>({
    companion_gender: "女生",
    nickname: "",
    user_profile: "",
    memory_summaries: "",
  });
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleStart = async () => {
    setStarted(true);
    await sendMessage("你好", []);
  };

  const sendMessage = async (text: string, currentHistory: Message[]) => {
    const userMsg: Message = { role: "user", content: text };
    const newHistory = [...currentHistory, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: currentHistory,
          config,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "未知错误" }));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: `错误: ${err.error}` };
          return updated;
        });
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      if (!reader) {
        setLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              content += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content };
                return updated;
              });
            }
          } catch {
            // 忽略不完整 JSON
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "网络错误，请重试" };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    await sendMessage(input.trim(), messages);
  };

  const handleReset = () => {
    setStarted(false);
    setMessages([]);
    setInput("");
    setConfig({ companion_gender: "女生", nickname: "", user_profile: "", memory_summaries: "" });
  };

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">AI 情感陪伴</h1>
          <p className="text-gray-400 mt-2 text-sm">
            不是助手，不是客服——是一个真正陪着你的朋友
          </p>
          <p className="text-gray-500 text-xs mt-1">每条消息消耗 2 积分</p>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-2">朋友的性别</label>
            <div className="grid grid-cols-3 gap-2">
              {["女生", "男生", "不限"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, companion_gender: v }))}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    config.companion_gender === v
                      ? "bg-brand text-white"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              你希望TA怎么称呼你？<span className="text-gray-500 text-xs ml-1">（选填）</span>
            </label>
            <input
              value={config.nickname}
              onChange={(e) => setConfig((c) => ({ ...c, nickname: e.target.value }))}
              placeholder="例如：小鱼、阿杰、宝、不限"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              关于你自己，想让TA提前了解什么？<span className="text-gray-500 text-xs ml-1">（选填）</span>
            </label>
            <textarea
              value={config.user_profile}
              onChange={(e) => setConfig((c) => ({ ...c, user_profile: e.target.value }))}
              placeholder="例如：我是一个996的程序员，养了一只猫叫豆豆，最近有点迷茫..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              你们之前聊过的重要的事<span className="text-gray-500 text-xs ml-1">（选填，让TA"记得"你们的历史）</span>
            </label>
            <textarea
              value={config.memory_summaries}
              onChange={(e) => setConfig((c) => ({ ...c, memory_summaries: e.target.value }))}
              placeholder="例如：上次聊了我和前任分手的事，TA帮我想通了很多..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>

          <button
            onClick={handleStart}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold mt-2"
          >
            开始聊天
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-sm text-gray-400">
            <span className="text-white font-medium">情感陪伴</span>
            <span className="mx-2">·</span>
            {config.companion_gender}朋友
            {config.nickname && <><span className="mx-2">·</span>称呼你"{config.nickname}"</>}
          </span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重新配置
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-rose-400/20 border border-rose-400/30 flex items-center justify-center text-xs text-rose-300 mr-2 mt-1 shrink-0">
                友
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand text-white rounded-br-md"
                  : "bg-surface card-glow text-gray-200 rounded-bl-md"
              }`}
            >
              {msg.content || (msg.role === "assistant" ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-white/5 px-4 py-4">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="说点什么..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl gradient-btn text-white disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
