"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function DouyinPage() {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60");
  const [type, setType] = useState("知识");

  return (
    <ToolLayout title="抖音脚本生成" description="短视频分镜脚本，含钩子+分镜+CTA" cost={5}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">视频主题 *</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：3个Excel技巧让你早下班"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">视频时长</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="15">15秒</option>
              <option value="30">30秒</option>
              <option value="60">60秒</option>
              <option value="180">3分钟</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">视频类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="知识">知识分享</option>
              <option value="剧情">剧情演绎</option>
              <option value="测评">产品测评</option>
              <option value="日常">日常 Vlog</option>
            </select>
          </div>
          <button
            onClick={() => onSubmit({ topic, duration, type })}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成脚本"}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
