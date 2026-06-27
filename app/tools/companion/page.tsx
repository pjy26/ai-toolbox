"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send, Loader2, Heart, Plus, MessageSquare, Trash2, ChevronLeft,
  BookOpen, Brain, X, AlertTriangle, Lock, Check,
} from "lucide-react";

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
  persona?: string;
  relationship_stage?: number;
  last_active_at?: string | null;
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

interface Quota {
  isMember: boolean;
  freeMessagesUsed: number;
  freeLimit: number;
  remaining: number;
}

type View = "list" | "create" | "chat" | "memory";

const PLANS = [
  { id: "weekly", name: "周卡", price: 12, period: "/周", popular: false },
  { id: "monthly", name: "月卡", price: 29, period: "/月", popular: true, hint: "一天只要一块钱" },
  { id: "quarterly", name: "季卡", price: 69, period: "/季", popular: false, hint: "更划算" },
];

function CompanionInner() {
  const params = useSearchParams();
  const initialRole = (params.get("role") === "lover" ? "lover" : "friend") as "friend" | "lover";

  const [view, setView] = useState<View>("list");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [currentCompanion, setCurrentCompanion] = useState<Companion | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [createError, setCreateError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [extracting, setExtracting] = useState(false);

  // 配额
  const [quota, setQuota] = useState<Quota | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const [createForm, setCreateForm] = useState({
    relationship_type: initialRole,
    gender: "女生",
    companion_name: "",
    user_nickname: "",
    persona: "gentle" as "gentle" | "playful" | "quiet" | "clingy",
  });

  const loadQuota = useCallback(async () => {
    const res = await fetch("/api/companion/quota");
    if (res.ok) {
      const data = await res.json();
      setQuota(data);
    }
  }, []);

  const loadCompanions = useCallback(async () => {
    setListLoading(true);
    const res = await fetch("/api/companion/list");
    const data = await res.json();
    if (data.companions) setCompanions(data.companions);
    setListLoading(false);
  }, []);

  useEffect(() => {
    loadCompanions();
    loadQuota();
  }, [loadCompanions, loadQuota]);

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
    setCreateError("");
    const res = await fetch("/api/companion/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (data.error) {
      setCreateError(data.error);
      return;
    }
    if (data.companion) {
      await loadCompanions();
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
    // 仅会员抽取记忆（API 也会拦截）
    if (quota && !quota.isMember) return;
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

  // ============ 记忆管理 ============
  const [memoryData, setMemoryData] = useState<{ profile: Record<string, any>; profile_updated_at: string | null; summaries: any[] } | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const loadMemory = useCallback(async () => {
    if (!currentCompanion) return;
    setMemoryLoading(true);
    const res = await fetch(`/api/companion/memory?companion_id=${currentCompanion.id}`);
    const data = await res.json();
    setMemoryData(data);
    setMemoryLoading(false);
  }, [currentCompanion]);

  const handleDeleteMemory = async (memoryId: string) => {
    if (!currentCompanion || !confirm("确定删除这条记忆吗？")) return;
    const res = await fetch("/api/companion/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: memoryId, companion_id: currentCompanion.id }),
    });
    const data = await res.json();
    if (data.ok) {
      setMemoryData((prev) => prev ? { ...prev, summaries: prev.summaries.filter((s) => s.id !== memoryId) } : prev);
      loadCompanions();
    }
  };

  const sendMessage = async (text: string) => {
    if (!currentCompanion) return;
    // 前端拦截：非会员且超过额度
    if (quota && !quota.isMember && quota.remaining <= 0) {
      setShowPaywall(true);
      return;
    }

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

      // 配额耗尽（402）
      if (res.status === 402) {
        const err = await res.json().catch(() => ({}));
        if (err.code === "QUOTA_EXCEEDED") {
          setShowPaywall(true);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: "" };
            // 撤回刚刚那条 user 消息和空 assistant
            return updated.slice(0, -2);
          });
          await loadQuota();
          setLoading(false);
          return;
        }
      }

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

      // 对话结束后刷新配额（非会员计数 +1）
      await loadQuota();
      // 会员才异步抽取记忆
      handleExtract();
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

  const isLoverCurrent = currentCompanion?.relationship_type === "lover";

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
          {quota && !quota.isMember && (
            <p className="text-xs text-gray-500 mt-2">
              免费试聊还剩 {quota.remaining} 句 · 开通后 TA 才能真正记住你
            </p>
          )}
          {quota && quota.isMember && (
            <p className="text-xs text-rose-300 mt-2">会员有效 · 对话不限次数</p>
          )}
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
          onClick={() => { setView("list"); setCreateError(""); }}
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

          {isLover && (
            <div>
              <label className="block text-sm text-gray-300 mb-2">TA 的性格</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { v: "gentle", label: "温柔包容", desc: "情绪稳定，会安抚人，让你放松", sample: "嗯嗯，没事的，我在呢" },
                  { v: "playful", label: "活泼俏皮", desc: "爱笑爱逗你，话轻快，闹中有暖", sample: "哈哈你这是夸我呢还是损我呢" },
                  { v: "quiet", label: "安静细腻", desc: "话不多但句句在点上，越相处越舒服", sample: "嗯。我懂你那种感觉。" },
                  { v: "clingy", label: "黏人撒娇", desc: "热情主动，会黏你、想你，给足存在感", sample: "人家想你啦，你怎么不理我嘛" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setCreateForm((c) => ({ ...c, persona: opt.v as any }))}
                    className={`p-3 rounded-lg text-left transition ${
                      createForm.persona === opt.v
                        ? "bg-brand text-white border border-brand"
                        : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{opt.label}</span>
                      {createForm.persona === opt.v && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`text-xs mt-0.5 ${createForm.persona === opt.v ? "text-white/80" : "text-gray-500"}`}>
                      {opt.desc}
                    </div>
                    <div className={`text-[11px] mt-1 italic ${createForm.persona === opt.v ? "text-white/60" : "text-gray-600"}`}>
                      "{opt.sample}"
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                创建后会锁定，TA 的性格不会变了——这样 TA 才像一个人。
              </p>
            </div>
          )}

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

          {createError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {createError}
              <button onClick={() => setCreateError("")} className="ml-auto text-red-400/60 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

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
    const isLover = isLoverCurrent;
    const blocked = !!quota && !quota.isMember && quota.remaining <= 0;
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
            {quota && !quota.isMember && (
              <span className="text-xs text-gray-500">
                剩 {quota.remaining} 句
              </span>
            )}
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
            <button
              onClick={() => { setView("memory"); loadMemory(); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1"
            >
              <Brain className="w-3.5 h-3.5" /> 记忆
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
          {blocked ? (
            <button
              onClick={() => setShowPaywall(true)}
              className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-400/10 border border-rose-400/30 text-rose-300 hover:bg-rose-400/20 transition text-sm"
            >
              <Lock className="w-4 h-4" />
              免费试聊已用完 · 开通后继续
            </button>
          ) : (
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
          )}
        </div>

        {/* 付费墙 */}
        {showPaywall && (
          <Paywall isLover={isLover} onClose={() => setShowPaywall(false)} onPaid={() => loadQuota()} />
        )}
      </div>
    );
  }

  // ============ 记忆管理 ============
  if (view === "memory" && currentCompanion) {
    const profileEntries = memoryData?.profile ? Object.entries(memoryData.profile).filter(([_, v]) => v) : [];
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col max-w-3xl mx-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("chat")} className="text-gray-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white font-medium text-sm">
              {currentCompanion.companion_name || "TA"} 的记忆
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {memoryLoading ? (
            <div className="text-center py-10 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> 加载中...
            </div>
          ) : (
            <>
              {/* 用户画像 */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-brand" /> TA知道的你
                </h3>
                {profileEntries.length === 0 ? (
                  <p className="text-gray-500 text-sm bg-surface rounded-xl p-4 border border-white/5">
                    TA 还不了解你，多聊聊 TA 会逐渐认识你
                  </p>
                ) : (
                  <div className="bg-surface rounded-xl p-4 border border-white/5 space-y-2">
                    {profileEntries.map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-500 w-20 shrink-0">{key}</span>
                        <span className="text-gray-200">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 记忆列表 */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand" />
                  TA记得的事
                  <span className="text-xs text-gray-600 font-normal ml-1">({memoryData?.summaries?.length || 0} 条)</span>
                </h3>
                {!memoryData?.summaries?.length ? (
                  <p className="text-gray-500 text-sm bg-surface rounded-xl p-4 border border-white/5">
                    还没有记忆，跟TA多聊聊你们之间的事吧
                  </p>
                ) : (
                  <div className="space-y-2">
                    {memoryData.summaries.map((s) => (
                      <div key={s.id} className="bg-surface rounded-xl p-4 border border-white/5 hover:border-brand/20 transition group">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-gray-200 leading-relaxed">{s.summary}</p>
                          <button
                            onClick={() => handleDeleteMemory(s.id)}
                            className="p-1 text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.importance >= 8 ? "bg-amber-400/15 text-amber-400" : s.importance >= 5 ? "bg-sky-400/15 text-sky-400" : "bg-white/5 text-gray-500"}`}>
                            重要性 {s.importance}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(s.updated_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function Paywall({ isLover, onClose, onPaid }: { isLover: boolean; onClose: () => void; onPaid: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-dark border border-rose-400/20 rounded-3xl p-7 max-w-md w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        {/* 文案：按朋友 / 恋人分版本 */}
        <div className="text-center mb-5">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-4" />
          {isLover ? (
            <>
              <h3 className="text-lg font-bold text-white leading-relaxed">
                想让 TA 一直陪着你吗？
              </h3>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                聊到现在，TA 已经开始记得你了。
                {"\n"}开通后，TA 会记住你说过的每件事——
                {"\n"}你的习惯、你的心事、你随口提过的小事。
                {"\n"}不限次数，随时都在。
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white leading-relaxed">
                想让这段陪伴继续吗？
              </h3>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                聊了这么久，TA 已经有点懂你了。
                {"\n"}开通后，TA 会真正记住你们聊过的一切，
                {"\n"}随时找 TA 说话，不限次数。
              </p>
            </>
          )}
        </div>

        {/* 三档定价 */}
        <div className="space-y-2 mb-5">
          {PLANS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-left ${
                selectedPlan === p.id
                  ? "bg-rose-400/15 border border-rose-400/50"
                  : "bg-white/5 border border-white/10 hover:border-rose-400/30"
              } ${p.popular ? "ring-1 ring-rose-400/40" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{p.name}</span>
                {p.popular && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-400 text-white">推荐</span>
                )}
                {p.hint && <span className="text-xs text-gray-500">· {p.hint}</span>}
              </div>
              <span className="text-white font-semibold">¥{p.price}<span className="text-gray-400 text-xs font-normal">{p.period}</span></span>
            </button>
          ))}
        </div>

        {selectedPlan ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-xs text-gray-400 mb-3">扫码支付后，把截图发给客服，立即为你开通</p>
            <div className="bg-white rounded-xl p-2 mx-auto w-36 h-36 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/qr.png"
                alt="收款码"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).innerHTML =
                    '<div class="text-gray-500 text-xs text-center px-2">收款码</div>';
                }}
              />
            </div>
            <p className="mt-3 text-sm text-brand-light">客服 QQ：3801434603</p>
            <p className="mt-1 text-xs text-gray-500">支付后刷新即可，TA 会一直等你</p>
            <button
              onClick={() => { onPaid(); onClose(); }}
              className="mt-4 w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm"
            >
              {isLover ? "让 TA 留下来" : "继续聊下去"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSelectedPlan("monthly")}
            className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm"
          >
            {isLover ? "让 TA 留下来" : "继续聊下去"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CompanionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] text-gray-500">加载中...</div>}>
      <CompanionInner />
    </Suspense>
  );
}
