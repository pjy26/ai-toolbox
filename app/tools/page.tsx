import Link from "next/link";
import {
  MessageSquare, BookOpen, Video, Sparkles, Heart, FileText,
  User, Mail, ArrowRight, BriefcaseIcon
} from "lucide-react";

const categories = [
  {
    name: "自媒体创作",
    desc: "文案生成 + 创作辅助，按赛道精准出稿",
    tools: [
      { key: "xiaohongshu", name: "小红书文案", desc: "美妆/穿搭/美食/母婴等赛道爆款笔记", icon: BookOpen, color: "text-red-400" },
      { key: "douyin", name: "抖音脚本", desc: "短视频分镜脚本，精确到秒", icon: Video, color: "text-pink-400" },
      { key: "title", name: "爆款标题", desc: "8种公式×10个备选，按平台适配", icon: Sparkles, color: "text-yellow-400" },
      { key: "moments", name: "朋友圈文案", desc: "3种风格一键生成，真诚/幽默/文艺", icon: Heart, color: "text-rose-400" },
    ],
  },
  {
    name: "职场办公",
    desc: "高频文书一键生成，告别加班写报告",
    tools: [
      { key: "weekly", name: "周报/日报", desc: "STAR法则结构化，5秒交差", icon: FileText, color: "text-green-400" },
      { key: "resume", name: "简历优化", desc: "量化成果+强动词，定向岗位改写", icon: User, color: "text-cyan-400" },
      { key: "email", name: "商务邮件", desc: "按收件人关系调整语气分寸", icon: Mail, color: "text-purple-400" },
    ],
  },
  {
    name: "AI 专家角色",
    desc: "一对一互动，追问+反馈+报告",
    tools: [
      { key: "interview", name: "AI 面试官", desc: "模拟真实面试，结束给评估报告", icon: BriefcaseIcon, color: "text-orange-400" },
    ],
  },
  {
    name: "通用对话",
    desc: "上面没覆盖的需求，这里兜底",
    tools: [
      { key: "chat", name: "AI 对话", desc: "多轮智能对话，有问必答", icon: MessageSquare, color: "text-blue-400" },
    ],
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">全部工具</h1>
      <p className="text-gray-400 text-sm mb-10">按需选用，每个工具都有精准提示词，不是套壳</p>

      {categories.map((cat) => (
        <div key={cat.name} className="mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{cat.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.tools.map((tool) => (
              <Link
                key={tool.key}
                href={`/tools/${tool.key}`}
                className="group p-5 rounded-2xl bg-surface card-glow hover:-translate-y-1 transition-all duration-200"
              >
                <tool.icon className={`w-7 h-7 ${tool.color} mb-3`} />
                <h3 className="font-semibold text-white group-hover:text-brand-light transition">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm text-gray-400">{tool.desc}</p>
                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-brand mt-3 transition" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
