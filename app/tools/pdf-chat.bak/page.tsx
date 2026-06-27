"use client";

import { FileText, Construction } from "lucide-react";

export default function PDFChatPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">PDF 文档问答</h1>
        <p className="text-gray-400 mt-1">上传文档智能问答</p>
        <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-brand/10 text-brand-light text-xs">
          消耗 10 积分/次
        </span>
      </div>

      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-surface card-glow max-w-md text-center p-8 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center mx-auto mb-4">
            <Construction className="w-8 h-8 text-brand-light" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">功能开发中</h3>
          <p className="text-gray-400 mb-4">
            PDF 文档问答功能正在开发中，将支持：
          </p>
          <div className="text-left space-y-2 text-gray-300">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-brand-light" /> PDF 上传与解析</div>
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-brand-light" /> 文本分块与向量化存储</div>
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-brand-light" /> 基于文档内容的智能问答</div>
          </div>
        </div>
      </div>
    </div>
  );
}
