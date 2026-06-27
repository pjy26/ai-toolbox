"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, RotateCcw, BriefcaseIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InterviewConfig {
  position: string;
  industry: string;
  level: string;
  round: string;
}

export default function InterviewPage() {
  const [config, setConfig] = useState<InterviewConfig>({
    position: "",
    industry: "互联网",
    level: "1-3年",
    round: "专业面",
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
    if (!config.position.trim()) return;
    setStarted(true);
    // 发送一条触发消息，让面试官开场
    await sendMessage("你好，我准备好了，请开始面试。", []);
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
      const res = await fetch("/api/interview", {
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
    setConfig({ position: "", industry: "互联网", level: "1-3年", round: "专业面" });
  };

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <BriefcaseIcon className="w-12 h-12 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-bold">AI 面试官</h1>
          <p className="text-gray-400 mt-2 text-sm">
            模拟真实面试全流程，一对一追问 + 面试结束后给出完整评估报告
          </p>
          <p className="text-gray-500 text-xs mt-1">每轮对话消耗 3 积分</p>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">应聘岗位 *</label>
            <input
              value={config.position}
              onChange={(e) => setConfig((c) => ({ ...c, position: e.target.value }))}
              placeholder="例如：高级前端工程师、产品经理、运营专员"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">行业领域</label>
              <select
                value={config.industry}
                onChange={(e) => setConfig((c) => ({ ...c, industry: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
              >
                {["互联网", "金融/银行", "快消/零售", "医疗健康", "教育", "制造业", "咨询"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">经验级别</label>
              <select
                value={config.level}
                onChange={(e) => setConfig((c) => ({ ...c, level: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
              >
                {["校招", "1-3年", "3-5年", "管理岗"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">面试轮次</label>
            <div className="grid grid-cols-3 gap-2">
              {["HR面", "专业面", "终面"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, round: v }))}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    config.round === v
                      ? "bg-brand text-white"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleStart}
            disabled={!config.position.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50 mt-2"
          >
            开始面试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="text-sm text-gray-400">
          <span className="text-white font-medium">{config.position}</span>
          <span className="mx-2">·</span>
          {config.industry}
          <span className="mx-2">·</span>
          {config.level}
          <span className="mx-2">·</span>
          {config.round}
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
              <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs text-brand mr-2 mt-1 shrink-0">
                面
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand text-white rounded-br-md"
                  : "bg-surface card-glow text-gray-200 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-sm max-w-none">
                  {msg.content || "思考中..."}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
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
            placeholder="回答面试官的问题..."
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
