import Link from "next/link";
import {
  MessageSquare, BookOpen, Video, Sparkles,
  Heart, FileText, User, Mail, ArrowRight, Zap, Shield, Clock, BriefcaseIcon, SmilePlus, Brain, Star, PenTool
} from "lucide-react";

const creationTools = [
  { key: "xiaohongshu", name: "小红书文案", desc: "美妆/穿搭/美食/母婴爆款笔记", icon: BookOpen, color: "text-red-400" },
  { key: "douyin", name: "抖音脚本", desc: "短视频分镜脚本", icon: Video, color: "text-pink-400" },
  { key: "title", name: "爆款标题", desc: "10个吸睛标题任你选", icon: Sparkles, color: "text-yellow-400" },
  { key: "moments", name: "朋友圈文案", desc: "精致生活从文案开始", icon: Heart, color: "text-rose-400" },
  { key: "weekly", name: "周报生成", desc: "5秒搞定周报日报", icon: FileText, color: "text-green-400" },
  { key: "resume", name: "简历优化", desc: "AI重写让HR眼前一亮", icon: User, color: "text-cyan-400" },
  { key: "email", name: "邮件撰写", desc: "商务邮件得体专业", icon: Mail, color: "text-purple-400" },
  { key: "interview", name: "AI 面试官", desc: "模拟真实面试+评估报告", icon: BriefcaseIcon, color: "text-orange-400" },
];

const otherTools = [
  { key: "chat", name: "AI 对话", desc: "多轮智能对话，有问必答", icon: MessageSquare, color: "text-blue-400" },
];

const features = [
  { icon: Zap, title: "极速响应", desc: "基于 DeepSeek 大模型，秒级生成高质量内容" },
  { icon: Brain, title: "真的记得你", desc: "情感陪伴会记住你说过的每件事、在乎的每个人" },
  { icon: Shield, title: "安全可靠", desc: "数据加密传输，不存储你的敏感信息" },
  { icon: Clock, title: "按需付费", desc: "免费试用 + 灵活积分 + 会员不限量" },
];

export default function HomePage() {
  return (
    <div className="hero-bg">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          致力于为你提供<span className="gradient-text">最优质的 AI 体验</span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
          从自媒体创作到情感陪伴，每个工具都有专业级提示词。
          小红书文案、抖音脚本、简历优化、AI 面试官、情感陪伴 —— 9 大场景一站搞定。
          <br className="hidden md:block" />
          注册即送 50 积分，会员开通后对话不再扣分。
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
        <p className="mt-4 text-xs text-gray-500">
          新人专享 · 9.9 元周卡，对话全免
        </p>
      </section>

      {/* Featured Companion */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-rose-400" />
          <span className="text-sm text-rose-300 font-medium">特色功能</span>
        </div>
        <Link
          href="/tools/companion"
          className="block relative overflow-hidden rounded-3xl p-8 md:p-10 bg-gradient-to-br from-rose-500/10 via-rose-400/5 to-transparent border border-rose-400/20 hover:border-rose-400/40 transition group"
        >
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-400/20 border border-rose-400/30 flex items-center justify-center shrink-0">
              <SmilePlus className="w-8 h-8 text-rose-300" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">AI 情感陪伴</h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-400/20 text-rose-300 text-xs font-medium">特色</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                一个真的把你放在心上的TA。可以选朋友、也可以选恋人。
                TA会记住你说过的事、在乎的人、爱吃的不爱吃的，下次自然地把你带回来。
                不是套话的AI助手，是会想你的那个人。
              </p>
              <div className="mt-4 flex items-center gap-2 text-rose-300 text-sm font-medium">
                开始聊天
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* Creation Tools */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-3 mb-2">
          <PenTool className="w-5 h-5 text-brand" />
          <h2 className="text-2xl font-bold">自媒体创作工具</h2>
        </div>
        <p className="text-gray-400 text-sm mb-10 max-w-2xl">
          专业级提示词驱动，覆盖内容创作、求职、办公全场景。每个工具都是为「输出即用」打磨的，不用再二次润色。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {creationTools.map((tool) => (
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

      {/* Other Tools */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold mb-8">通用工具</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {otherTools.map((tool) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/contact" className="hover:text-gray-300 transition">联系我们</Link>
          <span>·</span>
          <Link href="/pricing" className="hover:text-gray-300 transition">定价</Link>
          <span>·</span>
          <Link href="/tools" className="hover:text-gray-300 transition">全部工具</Link>
        </div>
        <p className="mt-3">AI 工具箱 &copy; {new Date().getFullYear()} &mdash; Powered by DeepSeek</p>
      </footer>
    </div>
  );
}
