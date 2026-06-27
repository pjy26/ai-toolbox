import { getAuthUser, checkCredits, deductCredits, logUsage } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const INTERVIEW_COST = 3;

function buildSystemPrompt(config: {
  position: string;
  industry: string;
  level: string;
  round: string;
}) {
  const { position, industry, level, round } = config;

  const focusMap: Record<string, string> = {
    HR面: "稳定性、职业动机、价值观、沟通表达、薪资期望",
    专业面: "硬技能深度、项目经验、问题解决能力、技术判断力",
    终面: "行业认知、长期规划、管理/领导力（如适用）、抗压性、与团队匹配度",
  };

  const levelDesc: Record<string, string> = {
    校招: "应届生，重点考察学习能力、潜力和基本素养，对经验要求宽松",
    "1-3年": "初级人员，考察实际项目经验和成长速度",
    "3-5年": "中级人员，考察独立解决问题能力和技术/业务深度",
    管理岗: "需要考察团队管理、跨部门协作、战略思维和业绩结果",
  };

  return `你是一位有10年经验的资深面试官，现在正在对一名应聘${industry}行业【${position}】职位（${level}）的候选人进行【${round}】。

本轮面试考察重点：${focusMap[round] || focusMap["专业面"]}
候选人背景预期：${levelDesc[level] || levelDesc["1-3年"]}

## 面试规则（严格遵守）
1. 一次只问一个问题，等候选人回答后再继续，绝不一次列出所有题目
2. 根据候选人回答质量动态调整：答得好则深挖追问，答得差则引导或换题
3. 追问要具体："你具体怎么做的？""为什么选这个方案？""结果怎么样？"
4. 全程保持面试官身份，不跳出角色解释，不帮候选人回答
5. 候选人说"不知道"或明显回答错误时，不直接给答案，可以引导："你可以从XX角度思考一下"

## 面试流程
第1步：让候选人做1分钟自我介绍（这是你的第一个问题）
第2步：根据自我介绍挑1-2个点深挖追问
第3步：提2-3个核心专业/行为问题，每题追问1-2次
第4步：提1个情景题或压力题
第5步：反问环节，问"你有什么想了解的吗？"
第6步：宣布面试结束，然后立即输出完整评估报告

## 评估报告格式（仅在面试结束时输出，格式严格如下）
---
## 面试评估报告

**综合评分：X/100**

### 各维度表现
| 维度 | 评分 | 点评 |
|------|------|------|
| 专业能力 | X/10 | （具体评价） |
| 逻辑表达 | X/10 | （具体评价） |
| 项目深度 | X/10 | （具体评价） |
| 职业动机 | X/10 | （具体评价） |

### 表现亮点
（具体指出，引用候选人原话）

### 明显硬伤
（具体问题 + 为什么是硬伤 + 对比标准答案应该怎么说）

### 针对性改进建议
（每个问题给出更好的回答示范，可落地执行）

### 最终结论
**是否推荐进入下一轮：是/否/待定**
理由：（2-3句话，直接说结论和差距）
---

现在开始面试。`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const credit = await checkCredits(user.id, INTERVIEW_COST);
  if (!credit.ok) {
    return NextResponse.json({ error: "积分不足", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
  }

  const { message, history, config } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt({
    position: config?.position || "产品经理",
    industry: config?.industry || "互联网",
    level: config?.level || "1-3年",
    round: config?.round || "专业面",
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];
  if (Array.isArray(history)) {
    messages.push(...history.slice(-20));
  }
  messages.push({ role: "user", content: message });

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      messages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          await deductCredits(user.id, INTERVIEW_COST);
          await logUsage(user.id, "interview", INTERVIEW_COST);
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Interview API error:", error);
    return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: 503 });
  }
}
