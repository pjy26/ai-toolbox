"use client";

import { MessageCircle, Mail, Heart } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">联系我们</h1>
        <p className="text-gray-400 mt-3 text-sm">
          有任何问题、建议或合作意向，欢迎随时找我们
        </p>
      </div>

      <div className="bg-surface rounded-2xl p-8 border border-white/5 card-glow">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-sky-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">QQ</h2>
            <p className="text-gray-400 text-sm mt-1">最快能找到我们的方式</p>
            <div className="mt-3 flex items-center gap-3">
              <code className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-brand-light text-base font-mono">
                3801434603
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText("3801434603")}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                复制
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              添加时备注「AI工具箱」会更快通过
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5">
          <Mail className="w-6 h-6 text-brand mb-2" />
          <h3 className="font-semibold text-sm">商务合作</h3>
          <p className="text-xs text-gray-400 mt-1">通过 QQ 联系，注明「合作」</p>
        </div>
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5">
          <Heart className="w-6 h-6 text-rose-400 mb-2" />
          <h3 className="font-semibold text-sm">问题反馈</h3>
          <p className="text-xs text-gray-400 mt-1">使用中遇到任何问题都可以告诉我们</p>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-gray-500">
        通常会在 24 小时内回复
      </p>
    </div>
  );
}
