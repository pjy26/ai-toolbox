"use client";

import { useState } from "react";
import { Loader2, Copy, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ToolLayoutProps {
  title: string;
  description: string;
  cost: number;
  children: (props: { onSubmit: (input: Record<string, string>) => void; loading: boolean }) => React.ReactNode;
}

export function ToolLayout({ title, description, cost, children }: ToolLayoutProps) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastInput, setLastInput] = useState<Record<string, string> | null>(null);

  const toolKey = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

  const handleSubmit = async (input: Record<string, string>) => {
    setLoading(true);
    setError("");
    setResult("");
    setLastInput(input);

    try {
      const res = await fetch(`/api/tools/${toolKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          setError("积分不足，请充值后继续使用");
        } else {
          setError(data.error || "生成失败");
        }
        return;
      }

      setResult(data.result);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (lastInput) handleSubmit(lastInput);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-gray-400 mt-1">{description}</p>
        <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-brand/10 text-brand-light text-xs">
          消耗 {cost} 积分/次
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="rounded-2xl bg-surface card-glow p-6">
          {children({ onSubmit: handleSubmit, loading })}
        </div>

        {/* Output */}
        <div className="rounded-2xl bg-surface card-glow p-6 min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-gray-300">生成结果</h3>
            {result && (
              <div className="flex gap-2">
                <button onClick={handleRetry} className="p-1.5 rounded-lg hover:bg-white/5" title="重新生成">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-white/5" title="复制">
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
              <span className="ml-2 text-gray-400">AI 正在生成中...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-300">{error}</p>
                {error.includes("积分不足") && (
                  <Link href="/pricing" className="text-xs text-brand-light hover:underline mt-1 inline-block">
                    去充值 →
                  </Link>
                )}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="flex-1 overflow-y-auto">
              {copied && <p className="text-xs text-green-400 mb-2">已复制到剪贴板</p>}
              <div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
                {result}
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              填写左侧表单后点击生成
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
