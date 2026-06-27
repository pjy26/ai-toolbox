"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function ResumePage() {
  const [content, setContent] = useState("");
  const [position, setPosition] = useState("");

  return (
    <ToolLayout title="简历优化" description="AI重写你的简历，量化成果让HR眼前一亮" cost={8}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">目标岗位</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="例如：高级前端工程师"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">粘贴简历内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="把你的简历文本粘贴到这里..."
              rows={10}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={() => onSubmit({ topic: content, content, position })}
            disabled={loading || !content.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "优化中..." : "优化简历"}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
