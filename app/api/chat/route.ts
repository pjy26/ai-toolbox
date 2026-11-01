import { getAuthUser, checkCredits, deductCredits, logUsage } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { contentSafetyMessage, scanWaffoContent } from "@/lib/content-safety";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const credit = await checkCredits(user.id, 2);
  if (!credit.ok) {
    return NextResponse.json({ error: "积分不足", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
  }
  const isMember = credit.isMember;

  const { message, history, locale: requestedLocale } = await req.json();
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }
  const locale = requestedLocale === "en" ? "en" : "zh";
  if (!await scanWaffoContent(message, locale, "input")) {
    return NextResponse.json({ error: contentSafetyMessage(locale, "input"), code: "CONTENT_REVIEW_REQUIRED" }, { status: 422 });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: "你是一个专业的 AI 助手，用中文回答，除非用户要求使用其他语言。" },
  ];
  if (Array.isArray(history)) messages.push(...history.slice(-10));
  messages.push({ role: "user", content: message });

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-v4-pro",
      messages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          for await (const chunk of stream) fullText += chunk.choices?.[0]?.delta?.content || "";
          if (!fullText || !await scanWaffoContent(fullText, locale, "output")) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: contentSafetyMessage(locale, "output") })}\n\n`));
            controller.close();
            return;
          }

          // Output is reviewed before any generated text reaches the browser.
          for (let offset = 0; offset < fullText.length; offset += 24) {
            const data = JSON.stringify({ choices: [{ delta: { content: fullText.slice(offset, offset + 24) } }] });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          if (!isMember) await deductCredits(user.id, 2);
          await logUsage(user.id, "chat", isMember ? 0 : 2);
        } catch (err) {
          console.error("AI stream failed", err instanceof Error ? err.message : "Unknown error");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: contentSafetyMessage(locale, "output") })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: 503 });
  }
}
