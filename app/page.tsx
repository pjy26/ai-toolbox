import Link from "next/link";
import {
  MessageSquare, BookOpen, Video, Sparkles,
  Heart, FileText, User, Mail, ArrowRight, Zap, Shield, Clock, BriefcaseIcon, SmilePlus
} from "lucide-react";

const tools = [
  { key: "chat", name: "AI 对话", desc: "多轮智能对话，有问必答", icon: MessageSquare, color: "text-blue-400" },
  { key: "xiaohongshu", name: "小红书文案", desc: "美妆/穿搭/美食/母婴爆款笔记", icon: BookOpen, color: "text-red-400" },
  { key: "douyin", name: "抖音脚本", desc: "短视频分镜脚本", icon: Video, color: "text-pink-400" },
  { key: "title", name: "爆款标题", desc: "10个吸睛标题任你选", icon: Sparkles, color: "text-yellow-400" },
  { key: "moments", name: "朋友圈文案", desc: "精致生活从文案开始", icon: Heart, color: "text-rose-400" },
  { key: "weekly", name: "周报生成", desc: "5秒搞定周报日报", icon: FileText, color: "text-green-400" },
  { key: "resume", name: "简历优化", desc: "AI重写让HR眼前一亮", icon: User, color: "text-cyan-400" },
  { key: "email", name: "邮件撰写", desc: "商务邮件得体专业", icon: Mail, color: "text-purple-400" },
  { key: "interview", name: "AI 面试官", desc: "模拟真实面试+评估报告", icon: BriefcaseIcon, color: "text-orange-400" },
  { key: "companion", name: "AI 情感陪伴", desc: "像朋友一样陪你聊天", icon: SmilePlus, color: "text-rose-400" },
];

const features = [
  { icon: Zap, title: "极速响应", desc: "基于 DeepSeek 大模型，秒级生成高质量内容" },
  { icon: Shield, title: "安全可靠", desc: "数据加密传输，不存储你的敏感信息" },
  { icon: Clock, title: "按需付费", desc: "免费试用 + 灵活积分 + 会员不限量" },
];

export default function HomePage() {
  return (
    <div className="hero-bg">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-24 pb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          致力于为你提供<span className="gradient-text">最优质的 AI 体验</span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
          每个工具都有专业级提示词，小红书文案、抖音脚本、情感陪伴、面试练习 —— 9 大场景一站搞定，注册即送 50 积分
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="px-8 py-3 rounded-xl gradient-btn text-white font-semibold text-base"
          >
            免费试用
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-3 rounded-xl border border-white/10 text-gray-300 hover:border-brand/50 hover:text-white transition font-medium"
          >
            查看定价
          </Link>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-12">全部工具</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.key}
              href={`/tools/${tool.key}`}
              className="group p-5 rounded-2xl bg-surface card-glow hover:-translate-y-1 transition-all duration-200"
            >
              <tool.icon className={`w-8 h-8 ${tool.color} mb-3`} />
              <h3 className="font-semibold text-white group-hover:text-brand-light transition">
                {tool.name}
              </h3>
              <p className="mt-1 text-sm text-gray-400">{tool.desc}</p>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-brand mt-3 transition" />
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl bg-surface/50 border border-white/5 text-center">
              <f.icon className="w-10 h-10 text-brand mx-auto mb-4" />
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-500">
        <p>AI 工具箱 &copy; {new Date().getFullYear()} &mdash; Powered by DeepSeek</p>
      </footer>
    </div>
  );
}
