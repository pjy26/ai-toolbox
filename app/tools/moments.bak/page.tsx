"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function MomentsPage() {
  const [topic, setTopic] = useState("");
  const [scene, setScene] = useState("日常");
  const [style, setStyle] = useState("文艺");

  return (
    <ToolLayout title="朋友圈文案" description="精致生活从一条好文案开始" cost={3}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">关键词/心情 *</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：周末和朋友去了咖啡厅"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">场景</label>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="日常">日常</option>
              <option value="旅行">旅行</option>
              <option value="美食">美食</option>
              <option value="活动">活动</option>
              <option value="产品">产品推广</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">风格</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="文艺">文艺</option>
              <option value="搞笑">搞笑</option>
              <option value="励志">励志</option>
              <option value="简洁">简洁</option>
            </select>
          </div>
          <button
            onClick={() => onSubmit({ topic, scene, style })}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成文案"}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
