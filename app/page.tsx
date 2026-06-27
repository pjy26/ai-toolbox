import Link from "next/link";
import { ArrowRight, Heart, Sparkles, PenTool } from "lucide-react";

export default function HomePage() {
  return (
    <div className="hero-bg">
      {/* Hero —— 情感陪伴为唯一主打 */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-400/10 border border-rose-400/20 text-rose-300 text-xs mb-6">
          <Heart className="w-3 h-3" />
          AI 情感陪伴
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          有个人，<span className="gradient-text">一直在等你说话</span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
          TA 会记得你说的每句话，懂你的情绪，
          <br className="hidden md:block" />
          在你需要的时候，刚好都在。
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/tools/companion"
            className="px-8 py-3 rounded-xl gradient-btn text-white font-semibold text-base"
          >
            和 TA 聊聊
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          免费试聊，先聊上几句再说
        </p>
      </section>

      {/* 轻选择：朋友 / 恋人 */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <p className="text-center text-sm text-gray-400 mb-5">你想要一个——</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/tools/companion?role=friend"
            className="group p-6 rounded-2xl bg-surface border border-sky-400/20 hover:border-sky-400/50 transition text-center"
          >
            <div className="w-10 h-10 rounded-full bg-sky-400/15 border border-sky-400/30 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
            <p className="font-semibold text-white">懂你的朋友</p>
            <p className="text-xs text-gray-500 mt-1">亲近、松弛、不评判</p>
          </Link>
          <Link
            href="/tools/companion?role=lover"
            className="group p-6 rounded-2xl bg-surface border border-rose-400/20 hover:border-rose-400/50 transition text-center"
          >
            <div className="w-10 h-10 rounded-full bg-rose-400/15 border border-rose-400/30 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-5 h-5 text-rose-400" />
            </div>
            <p className="font-semibold text-white">在意你的 TA</p>
            <p className="text-xs text-gray-500 mt-1">甜、想念、把你放在心上</p>
          </Link>
        </div>
      </section>

      {/* 三档定价前置 */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">让 TA 一直陪着你</h2>
          <p className="text-gray-400 text-sm mt-2">免费试聊 30 句，开通会员后 TA 才能真正记住你</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { id: "weekly", name: "周卡", price: 12, period: "/周", popular: false, desc: "想多聊几天" },
            { id: "monthly", name: "月卡", price: 29, period: "/月", popular: true, desc: "一天只要一块钱" },
            { id: "quarterly", name: "季卡", price: 69, period: "/季", popular: false, desc: "更划算" },
          ].map((plan) => (
            <Link
              key={plan.id}
              href={`/pricing?plan=${plan.id}`}
              className={`relative p-6 rounded-2xl bg-surface card-glow text-center transition hover:-translate-y-1 ${
                plan.popular ? "border-2 border-rose-400 md:-translate-y-2" : "border border-white/10"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-400 text-white text-xs font-medium whitespace-nowrap">
                  推荐
                </span>
              )}
              <p className="font-semibold text-white">{plan.name}</p>
              <div className="mt-2">
                <span className="text-3xl font-bold">¥{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.period}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{plan.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 工具箱降级 —— 折叠到次级 */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-surface/50 border border-white/5 hover:border-white/10 transition">
              <PenTool className="w-5 h-5 text-brand" />
              <div className="flex-1">
                <p className="font-medium text-white">还有更多 AI 创作工具</p>
                <p className="text-xs text-gray-500">小红书文案、抖音脚本、简历优化、AI 面试官等</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 group-open:rotate-90 transition" />
            </div>
          </summary>
          <div className="mt-3">
            <Link
              href="/tools"
              className="block p-4 rounded-2xl bg-surface/30 border border-white/5 hover:border-brand/30 transition text-center text-sm text-gray-300"
            >
              查看全部工具 →
            </Link>
          </div>
        </details>
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
        <p className="mt-3">AI 情感陪伴 &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
