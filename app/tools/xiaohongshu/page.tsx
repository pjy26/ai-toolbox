"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/tool-layout";

const TRACKS = ["美妆", "穿搭", "美食", "母婴"];

const audiencePlaceholders: Record<string, string> = {
  美妆: "例如：黄皮敏感肌、学生党、30+熟龄肌",
  穿搭: "例如：梨形身材、微胖女生、职场新人",
  美食: "例如：减脂人群、上班族、爱做饭的家庭",
  母婴: "例如：0-1岁宝宝妈妈、新手父母、二胎家庭",
};

const topicPlaceholders: Record<string, string> = {
  美妆: "例如：某平价粉底液",
  穿搭: "例如：今天的上班穿搭",
  美食: "例如：家常红烧肉",
  母婴: "例如：某品牌婴儿推车",
};

export default function XiaohongshuPage() {
  const [topic, setTopic] = useState("");
  const [track, setTrack] = useState("美妆");
  const [type, setType] = useState("种草推荐");
  const [audience, setAudience] = useState("");
  const [style, setStyle] = useState("真诚分享");
  const [length, setLength] = useState("500");

  return (
    <ToolLayout title="小红书文案生成" description="赛道精准提示词，生成可直接发布的爆款笔记" cost={5}>
      {({ onSubmit, loading }) => (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">内容赛道</label>
            <div className="grid grid-cols-4 gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrack(t)}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    track === t
                      ? "bg-brand text-white"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:border-brand/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">产品/话题 *</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={topicPlaceholders[track]}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">内容类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
              >
                <option value="种草推荐">种草推荐</option>
                <option value="产品测评">产品测评</option>
                <option value="教程攻略">教程攻略</option>
                <option value="避坑指南">避坑指南</option>
                <option value="生活日记">生活日记</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">写作风格</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
              >
                <option value="真诚分享">真诚分享</option>
                <option value="专业测评">专业测评</option>
                <option value="搞笑种草">搞笑种草</option>
                <option value="精致生活">精致生活</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">目标人群（可选）</label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={audiencePlaceholders[track]}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">字数</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-white/10 text-white focus:border-brand focus:outline-none"
              >
                <option value="300">约300字（精简版）</option>
                <option value="500">约500字（标准版）</option>
                <option value="800">约800字（详细版）</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => onSubmit({ topic, track, type, audience, style, length })}
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
