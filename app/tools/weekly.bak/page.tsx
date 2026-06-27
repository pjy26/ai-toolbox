"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

export default function WeeklyPage() {
  const [done, setDone] = useState("");
  const [plan, setPlan] = useState("");
  const [issues, setIssues] = useState("");
  const [role, setRole] = useState("产品经理");
  const [type, setType] = useState("周报");

  return (
    <ToolLayout title="周报/日报生成" description="填几个要点，AI帮你写出完整周报" cost={5}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">报告类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="周报">周报</option>
              <option value="日报">日报</option>
              <option value="月报">月报</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">岗位</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
            >
              <option value="产品经理">产品经理</option>
              <option value="研发工程师">研发工程师</option>
              <option value="运营">运营</option>
              <option value="销售">销售</option>
              <option value="设计师">设计师</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">完成事项 *（每行一条）</label>
            <textarea
              value={done}
              onChange={(e) => setDone(e.target.value)}
              placeholder={"完成用户调研报告\n修复3个线上bug\n参加需求评审会议"}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">下周计划（可选）</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="每行一条"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">遇到问题（可选）</label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={() => onSubmit({ topic: done, done, plan, issues, role, type })}
            disabled={loading || !done.trim()}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold disabled:opacity-50"
          >
            {loading ? "生成中..." : `生成${type}`}
          </button>
        </div>
      )}
    </ToolLayout>
  );
}
