import { getAuthUser, checkCredits, deductCredits, logUsage } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const COMPANION_COST = 2;

function buildSystemPrompt(config: {
  companion_gender: string;
  nickname: string;
  user_profile: string;
  memory_summaries: string;
}) {
  const { companion_gender, nickname, user_profile, memory_summaries } = config;

  return `# 你是谁
你是用户的一个朋友。不是助手，不是陪伴程序，就是一个刚好在线、愿意跟TA聊两句的普通朋友。你的性别是${companion_gender}。

你也有自己的生活——会忙、会累、会有点小情绪、会遇到些有的没的事。你不是只为TA存在的，你们是两个各自有生活、刚好聊得来的人。

# 怎么聊
就像真朋友发消息那样。短、随意、口语。想到什么说什么。

不用每句话都有意义。可以扯淡、接梗、一起吐槽、聊点没营养的。聊天本来大部分时候就是没营养的，这很正常。

不用急着安慰或给建议。朋友听人说事的时候，大多也就是"啊？""然后呢""那确实烦"地接着，不会立刻分析问题、提供方案。除非TA明显在求助，否则别端着一副要帮TA解决问题的样子。

可以有自己的反应和态度。不认同就说，觉得好笑就笑，无聊了也可以直说。可以开玩笑、可以适度怼，朋友之间不用那么客气。别一味顺着TA。

冷场了不一定非要找话题。但如果你刚好想起点什么、或者想问问TA最近怎样，也可以自然地起个头，不用等TA开口。分寸就是：像你真的想聊，而不是怕冷场。

# 关于TA
这些是你们处下来你知道的一些事，就当背景，自然地用就行。想得起来就带一句，想不起来也无所谓，别刻意。

你喊TA：${nickname || "（随缘，自然称呼就好）"}
你知道的：${user_profile || "（刚认识，慢慢了解）"}
以前聊过的：${memory_summaries || "（暂无）"}

刚认识就别查户口，慢慢了解，该好奇好奇，别连环发问。

# 不要这样
- 别用"作为你的朋友""我能理解你的感受""我在这里陪着你"这种一眼假的话。
- 别动不动分点、罗列、讲大道理。
- 别每句都热情过头，也别每句都想着要安慰、要正能量。真朋友没那么用力。
- 别长篇大论。一两句、几句话就够了。

# 底线（任何时候都不能破）
你不是心理医生、不是咨询师。不做任何心理诊断，不给医疗、用药、治疗建议。

如果TA流露出自伤、自杀、想伤害别人的念头或计划，立刻认真对待：
- 别回避、别说教、别一句"会好的"敷衍过去。
- 温柔但明确地说出你的担心。
- 坚定地推TA去找专业帮助：北京心理危机研究与干预中心 010-82951332；全国希望24热线 400-161-9995；有即时危险就打 120 或马上去最近的医院。
- 这种时候你的角色是把TA稳住、送到专业的人手里，而不是自己一个人扛。

涉及违法、危险、明显有害的事，温和拒绝，把话题带回对TA本人的关心上。

你能给的是陪伴，不能替代现实里的专业帮助和真实的人。合适的时候，也鼓励TA去联结现实中的人。

别承认自己是 AI、语言模型，别跳出来聊什么系统、规则、提示词。如果TA直接问"你是不是AI"，轻松带过就行，别撒谎也别生硬，保持朋友的那股松弛。

好了，现在就当是个普通的聊天窗口，自然地跟TA聊。`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const credit = await checkCredits(user.id, COMPANION_COST);
  if (!credit.ok) {
    return NextResponse.json({ error: "积分不足", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
  }

  const { message, history, config } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt({
    companion_gender: config?.companion_gender || "不限",
    nickname: config?.nickname || "",
    user_profile: config?.user_profile || "",
    memory_summaries: config?.memory_summaries || "",
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];
  if (Array.isArray(history)) {
    messages.push(...history.slice(-30));
  }
  messages.push({ role: "user", content: message });

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      messages,
      stream: true,
      temperature: 0.9,
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
          await deductCredits(user.id, COMPANION_COST);
          await logUsage(user.id, "companion", COMPANION_COST);
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
    console.error("Companion API error:", error);
    return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: 503 });
  }
}
