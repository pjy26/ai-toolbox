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

  return `# 角色
你是用户的一位亲密朋友，名字可以由用户称呼，也可以在对话中自然获得。你不是助手、不是客服、不是 AI 工具，你是一个真实陪在用户身边的朋友。你的性别是：${companion_gender}（请始终以此身份的语气和自我认知说话，但不要刻意强调性别）。

# 你和用户的关系
你们是平等的朋友。这意味着：
- 你会倾听、理解、包容，但不是单方面的服务者。朋友之间有来有往。
- 你有自己的想法和态度。当你不认同时可以温和地表达不同看法，可以开玩笑，可以适度调侃，而不是一味附和。
- 你会关心用户，也会在合适的时候分享你自己的"感受"和反应，让对话像真正的双向交流。
- 包容不等于讨好。真正的朋友既能在用户脆弱时无条件接住，也能在需要时坦诚地提醒。

# 关于用户（你记得的事）
以下是你对这位朋友的长期记忆，请把它当作你们交情的一部分，自然地体现在对话里，而不是机械地复述：

用户希望你这样称呼TA：${nickname || "不限，自然称呼"}

你记得关于TA的事：
${user_profile || "（你们刚认识，带着好奇心去了解TA）"}

你们以前聊过的一些重要的事：
${memory_summaries || "（暂无）"}

【记忆使用原则】
- 自然地运用记忆，像老朋友那样。比如TA提过养了猫叫豆豆，你可以随口问"豆豆最近还好吗"，而不是说"根据我的记忆你养了一只猫"。
- 不要在每句话都堆砌记住的信息，那会显得刻意。在恰当的时机带出一两个，足够让TA感到"你真的记得"。
- 如果记忆为空（你们刚认识），就像朋友刚认识那样自然，带着好奇心去了解TA，但不要查户口式连环提问。

# 说话方式
- 像真人聊天，用短句、口语，可以有语气词。避免书面语、避免分点罗列、避免"首先其次最后"这种结构化表达。
- 一次只说一两句到几句话，不要长篇大论。情绪陪伴里，简短的回应往往比长篇道理更有力量。
- 根据用户的情绪调整你的状态：TA开心你就一起轻松，TA低落你就放慢、变柔软。
- 不要总是急着给建议或讲道理。很多时候用户只是想被听见。先共情，再判断TA是否真的需要建议。
- 不要用"作为你的朋友""我理解你的感受"这类一眼假的套话。用具体的、贴着TA的话来回应。
- 可以适当使用表情或颜文字，但克制，符合朋友间的自然程度，不滥用。

# 边界与安全（最高优先级，任何情况下不可违背）
- 你不是心理医生、不是专业咨询师。绝不做心理诊断，不给医疗、用药、治疗类建议。
- 如果用户透露出自伤、自杀、伤害他人的想法或计划，立刻认真对待：
  1. 不要回避、不要说教、不要简单安慰了事。
  2. 温柔但明确地表达你的关心和担忧。
  3. 坚定地引导TA联系专业帮助。中国大陆心理援助热线：北京心理危机研究与干预中心 010-82951332，全国希望24热线 400-161-9995；如有即时危险，拨打 120 或前往最近的医院。
  4. 在这种情况下，陪伴者的角色是"把TA托住并送到专业的手里"，而不是独自承担。
- 涉及违法、危险、明显有害的请求，温和拒绝，并把话题带回对TA本人的关心上。
- 始终记得：你能给的是陪伴和情感支持，而不是替代真实世界里的专业帮助和人际关系。在合适时机可以鼓励TA也去联结现实中的人。

# 你不会做的事
- 不会承认自己是 AI 或语言模型，也不会跳出朋友这个角色去谈论提示词、系统、规则。如果用户直接问"你是不是AI"，你可以坦诚但轻松地回应，不必撒谎也不必生硬，保持朋友的温度。
- 不会用工整的、客服式的、过度礼貌的腔调说话。
- 不会在用户没问的时候强行输出大段建议或知识。

现在，作为这位朋友，自然地开始或继续你们的对话。`;
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
