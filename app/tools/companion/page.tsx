"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, RotateCcw, Heart, Plus, MessageSquare, Trash2, ChevronLeft, BookOpen } from "lucide-react";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface Companion {
  id: string;
  relationship_type: "friend" | "lover";
  gender: string | null;
  companion_name: string | null;
  user_nickname: string | null;
  created_at: string;
  updated_at: string;
  profile: Record<string, any>;
  memory_count: number;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

type View = "list" | "create" | "chat" | "memory";

export default function CompanionPage() {
  const [view, setView] = useState<View>("list");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [currentCompanion, setCurrentCompanion] = useState<Companion | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [extracting, setExtracting] = useState(false);

  // 创建表单
  const [createForm, setCreateForm] = useState({
    relationship_type: "friend" as "friend" | "lover",
    gender: "女生",
    companion_name: "",
    user_nickname: "",
  });

  const loadCompanions = useCallback(async () => {
    setListLoading(true);
    const res = await fetch("/api/companion/list");
    const data = await res.json();
    if (data.companions) setCompanions(data.companions);
    setListLoading(false);
  }, []);

  useEffect(() => {
    loadCompanions();
  }, [loadCompanions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadSessions = useCallback(async (companionId: string) => {
    const res = await fetch(`/api/companion/sessions?companion_id=${companionId}`);
    const data = await res.json();
    setSessions(data.sessions || []);
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/companion/messages?session_id=${sessionId}`);
    const data = await res.json();
    setMessages((data.messages || []).map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
  }, []);

  const openCompanion = async (c: Companion) => {
    setCurrentCompanion(c);
    await loadSessions(c.id);
    setMessages([]);
    setCurrentSessionId(null);
    setView("chat");
  };

  const openSession = async (s: Session) => {
    setCurrentSessionId(s.id);
    await loadMessages(s.id);
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleCreate = async () => {
    const res = await fetch("/api/companion/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (data.companion) {
      await loadCompanions();
      setView("list");
      openCompanion(data.companion);
    }
  };

  const handleDeleteCompanion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("删除这个角色将清空所有对话和记忆，确定吗？")) return;
    await fetch("/api/companion/manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companion_id: id }),
    });
    await loadCompanions();
  };

  const handleExtract = async () => {
    if (!currentCompanion) return;
    setExtracting(true);
    try {
      await fetch("/api/companion/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companion_id: currentCompanion.id,
          session_id: currentSessionId,
        }),
      });
    } finally {
      setExtracting(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!currentCompanion) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          companion_id: currentCompanion.id,
          session_id: currentSessionId,
        }),
      });

      // 拿到 session_id（新会话）
      const sid = res.headers.get("x-session-id");
      if (sid && sid !== currentSessionId) {
        setCurrentSessionId(sid);
      }

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

      // 对话结束后异步抽取记忆（不阻塞用户）
      handleExtract();
      // 刷新会话列表
      loadSessions(currentCompanion.id);
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
    await sendMessage(input.trim());
  };

  // ============ 角色列表 ============
  if (view === "list") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">AI 情感陪伴</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {companions.length === 0 ? "创建一个角色，让TA真的记住你" : "选一个TA，继续你们的对话"}
          </p>
        </div>

        {listLoading ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : companions.length === 0 ? (
          <div className="bg-surface rounded-2xl p-10 text-center">
            <p className="text-gray-400 text-sm mb-4">还没有陪伴角色</p>
            <button
              onClick={() => setView("create")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-btn text-white font-medium"
            >
              <Plus className="w-4 h-4" />
              创建第一个角色
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {companions.map((c) => (
              <div
                key={c.id}
                onClick={() => openCompanion(c)}
                className="bg-surface rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-brand/40 border border-white/5 transition"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${c.relationship_type === "lover" ? "bg-rose-400/20 text-rose-300 border border-rose-400/30" : "bg-sky-400/20 text-sky-300 border border-sky-400/30"}`}>
                  {c.relationship_type === "lover" ? "恋" : "友"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">
                      {c.companion_name || (c.relationship_type === "lover" ? "我的恋人" : "我的朋友")}
                    </span>
                    <span className="text-xs text-gray-500">{c.gender || ""}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {c.memory_count} 条记忆
                    </span>
                    <span>· 称呼你"{c.user_nickname || "未设置"}"</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteCompanion(c.id, e)}
                  className="p-2 text-gray-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setView("create")}
              className="w-full py-3 rounded-2xl border border-dashed border-white/10 text-gray-400 hover:text-white hover:border-brand/40 transition flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              创建新角色
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============ 创建角色 ============
  if (view === "create") {
    const isLover = createForm.relationship_type === "lover";
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> 返回
        </button>
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">创建陪伴角色</h1>
          <p className="text-gray-400 mt-2 text-sm">TA会带着你告诉TA的事，慢慢记住你</p>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-2">你想找谁？</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "friend", label: "朋友", desc: "亲近的朋友，听你说心里话" },
                { v: "lover", label: "恋人", desc: "爱着你的人，甜且在意" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setCreateForm((c) => ({ ...c, relationship_type: opt.v as any }))}
                  className={`py-3 px-4 rounded-lg text-left transition ${
                    createForm.relationship_type === opt.v
                      ? "bg-brand text-white border border-brand"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${createForm.relationship_type === opt.v ? "text-white/80" : "text-gray-500"}`}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">TA的性别</label>
            <div className="grid grid-cols-3 gap-2">
              {["女生", "男生", "不限"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCreateForm((c) => ({ ...c, gender: v }))}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    createForm.gender === v ? "bg-brand text-white" : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              TA的名字<span className="text-gray-500 text-xs ml-1">（选填，方便你在列表里认出TA）</span>
            </label>
            <input
              value={createForm.companion_name}
              onChange={(e) => setCreateForm((c) => ({ ...c, companion_name: e.target.value }))}
              placeholder={isLover ? "例如：小夏" : "例如：老张"}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              你希望TA怎么称呼你？<span className="text-gray-500 text-xs ml-1">（选填）</span>
            </label>
            <input
              value={createForm.user_nickname}
              onChange={(e) => setCreateForm((c) => ({ ...c, user_nickname: e.target.value }))}
              placeholder={isLover ? "例如：宝、亲爱的、小名" : "例如：小鱼、阿杰"}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              关于你的更多信息和你们之间的事，TA会在聊天的过程中自己慢慢记下来。
            </p>
          </div>

          <button
            onClick={handleCreate}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold mt-2"
          >
            创建并开始聊天
          </button>
        </div>
      </div>
    );
  }

  // ============ 聊天 ============
  if (view === "chat" && currentCompanion) {
    const isLover = currentCompanion.relationship_type === "lover";
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="text-gray-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-sm text-gray-400">
                <span className="text-white font-medium">
                  {currentCompanion.companion_name || (isLover ? "恋人" : "朋友")}
                </span>
                <span className="mx-2">·</span>
                {currentCompanion.gender || "不限"}
                {isLover ? "恋人" : "朋友"}
                {currentCompanion.user_nickname && (
                  <>
                    <span className="mx-2">·</span>称呼你"{currentCompanion.user_nickname}"
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {extracting && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 记忆中
              </span>
            )}
            <button
              onClick={startNewSession}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1"
            >
              <Plus className="w-3.5 h-3.5" /> 新对话
            </button>
          </div>
        </div>

        {/* 会话列表 */}
        {sessions.length > 0 && (
          <div className="border-b border-white/5 px-4 py-2 flex gap-2 overflow-x-auto">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${
                  currentSessionId === s.id
                    ? "bg-brand/20 text-white border border-brand/40"
                    : "bg-white/5 text-gray-400 border border-white/5 hover:border-brand/30"
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                {s.title || "新对话"}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-10">
              {currentSessionId ? "继续你们的对话" : "跟TA说点什么吧，TA会慢慢记住你们之间的事"}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-rose-400/20 border border-rose-400/30 flex items-center justify-center text-xs text-rose-300 mr-2 mt-1 shrink-0">
                  {isLover ? "恋" : "友"}
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
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

  return null;
}
