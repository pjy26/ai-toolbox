"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function EmailPage() {
  const [topic, setTopic] = useState("");
  const [scene, setScene] = useState("工作汇报");
  const [relation, setRelation] = useState("上级");
  const [tone, setTone] = useState("正式");

  return (
    <ToolLayout title="邮件撰写" description="商务邮件得体专业，一键生成" cost={5}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">邮件场景</label>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="工作汇报">工作汇报</option>
              <option value="请假">请假申请</option>
              <option value="跟进">项目跟进</option>
              <option value="感谢">表达感谢</option>
              <option value="邀请">会议邀请</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">收件人关系</label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="上级">上级领导</option>
              <option value="同级">同事</option>
              <option value="下级">下属</option>
              <option value="客户">客户</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">核心内容 *</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="简单描述邮件要表达的核心内容"
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">语气</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="正式">正式</option>
              <option value="友好">友好</option>
              <option value="简洁">简洁直接</option>
            </select>
          </div>
          <button
            onClick={() => onSubmit({ topic, scene, relation, tone })}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "撰写中..." : "生成邮件"}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
