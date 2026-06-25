"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function TitlePage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("小红书");

  return (
    <ToolLayout title="爆款标题生成" description="10个吸睛标题任你选，适配各平台风格" cost={3}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">内容描述 *</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="简单描述你的内容，例如：分享5个提升工作效率的方法"
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">目标平台</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="小红书">小红书</option>
              <option value="抖音">抖音</option>
              <option value="公众号">公众号</option>
              <option value="B站">B站</option>
            </select>
          </div>
          <button
            onClick={() => onSubmit({ topic, platform })}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成10个标题"}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
