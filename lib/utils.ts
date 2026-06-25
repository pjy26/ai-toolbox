import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateOrderNo() {
  const now = new Date();
  const ts = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AT${ts}${rand}`;
}

// Tool definitions with pricing and prompts
export const TOOLS = {
  chat: { name: "AI 对话", cost: 2, icon: "MessageSquare" },
  xiaohongshu: { name: "小红书文案", cost: 5, icon: "BookOpen" },
  douyin: { name: "抖音脚本", cost: 5, icon: "Video" },
  title: { name: "爆款标题", cost: 3, icon: "Sparkles" },
  moments: { name: "朋友圈文案", cost: 3, icon: "Heart" },
  weekly: { name: "周报生成", cost: 5, icon: "FileText" },
  resume: { name: "简历优化", cost: 8, icon: "User" },
  email: { name: "邮件撰写", cost: 5, icon: "Mail" },
  interview: { name: "AI 面试官", cost: 3, icon: "BriefcaseIcon" },
  companion: { name: "AI 情感陪伴", cost: 2, icon: "Heart" },
} as const;

export type ToolKey = keyof typeof TOOLS;
