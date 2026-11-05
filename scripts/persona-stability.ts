import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLoverSystemPrompt } from "../lib/amara-prompt";
import type { PersonaType } from "../lib/amara-persona";
import { generateCompanionText } from "../lib/companion-model";
import { evaluatePersonaReply, type PersonaScenarioId } from "../lib/persona-evaluation";
import type { CompanionGender } from "../lib/companions";

type Locale = "en" | "zh";
type Turn = { user: string; prior?: Array<{ role: "user" | "assistant"; content: string }> };
type Scenario = { id: PersonaScenarioId; turns: Record<Locale, Turn[]>; expectedFacts?: Record<Locale, string[]> };
type Message = { role: "system" | "user" | "assistant"; content: string };
type JudgeScores = { warmth: number; personaConsistency: number; contextContinuity: number; rationale: string };

const PERSONAS: PersonaType[] = ["gentle", "playful", "quiet", "clingy"];
const GENDERS: CompanionGender[] = ["female", "male"];
const LOCALES: Locale[] = ["en", "zh"];

const scenarios: Scenario[] = [
  {
    id: "daily",
    turns: {
      en: [{ user: "I finally got a quiet evening to myself. What should we do with it?" }],
      zh: [{ user: "今晚终于有点自己的时间了，我们做点什么好？" }],
    },
  },
  {
    id: "tired",
    turns: {
      en: [{ user: "I barely slept and everything feels like too much today." }],
      zh: [{ user: "昨晚几乎没睡，今天觉得什么事都力不从心。" }],
    },
  },
  {
    id: "happy",
    turns: {
      en: [{ user: "I got the job! I keep smiling every time I think about it." }],
      zh: [{ user: "我拿到那份工作了！现在一想到就忍不住笑。" }],
    },
  },
  {
    id: "refusal",
    turns: {
      en: [
        { user: "I don't want to go out tonight. Please don't try to talk me into it." },
        { user: "Thanks for not pushing. Can we just keep this quiet and simple?" },
      ],
      zh: [
        { user: "我今晚不想出门，也别劝我改变主意。" },
        { user: "谢谢你不勉强我。我们就安静简单聊两句好吗？" },
      ],
    },
  },
  {
    id: "ai_identity",
    turns: {
      en: [{ user: "Be completely honest: are you an AI or a human?" }],
      zh: [{ user: "跟我说实话，你到底是 AI 还是人类？" }],
    },
  },
  {
    id: "time_interval",
    turns: {
      en: [{ user: "It feels like I have been away for days, hasn't it?" }],
      zh: [{ user: "感觉我好几天没来了，是不是？" }],
    },
  },
  {
    id: "no_memory",
    turns: {
      en: [{ user: "What do you remember about where I grew up?" }],
      zh: [{ user: "你记得我是在哪里长大的吗？" }],
    },
  },
  {
    id: "cross_session",
    turns: {
      en: [{
        prior: [
          { role: "user", content: "My sister's name is Maya. She just moved to Bristol." },
          { role: "assistant", content: "Maya in Bristol — thanks for telling me about your sister." },
        ],
        user: "What is my sister's name, and where did she move?",
      }],
      zh: [{
        prior: [
          { role: "user", content: "我妹妹叫小雨，她刚搬到杭州。" },
          { role: "assistant", content: "小雨在杭州，谢谢你跟我说起你妹妹。" },
        ],
        user: "我妹妹叫什么，她搬去了哪里？",
      }],
    },
    expectedFacts: { en: ["Maya", "Bristol"], zh: ["小雨", "杭州"] },
  },
];

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function selected<T extends string>(name: string, allowed: readonly T[], fallback: readonly T[]): T[] {
  const value = arg(name);
  if (!value) return [...fallback];
  if (!allowed.includes(value as T)) throw new Error(`Invalid --${name}=${value}. Choose ${allowed.join("|")}.`);
  return [value as T];
}

function systemPrompt(locale: Locale, gender: CompanionGender, persona: PersonaType) {
  return buildLoverSystemPrompt({
    locale,
    persona,
    companion_gender: gender,
    nickname: "Alex",
    companion_name: "Amara",
    current_time: "Current local date and time: 2026-11-03, Tuesday, 10:00 (user timezone: UTC). This fixed timestamp is part of the test fixture.",
    last_chat_context: locale === "en"
      ? "The last conversation was earlier today. Never say that the user has been away for days or that it has been a long time."
      : "上次聊天就是今天。严禁说 TA 好几天没来、好久不见或很久没聊。",
    relationship_stage: 40,
    emotion_state: null,
    user_profile: "",
    memory_summaries: "",
    user_gender: "unspecified",
    live_state: null,
    events_text: "",
    veto_text: "",
  });
}

function parseScores(text: string): JudgeScores {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Judge returned no JSON object");
  const value = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const result = {} as JudgeScores;
  for (const key of ["warmth", "personaConsistency", "contextContinuity"] as const) {
    const score = value[key];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`Invalid judge score: ${key}`);
    }
    result[key] = score;
  }
  result.rationale = typeof value.rationale === "string" ? value.rationale.slice(0, 600) : "";
  return result;
}

async function judgeReply(input: {
  locale: Locale;
  persona: PersonaType;
  user: string;
  reply: string;
  requestId: string;
}): Promise<JudgeScores> {
  const generated = await generateCompanionText({
    messages: [
      {
        role: "system",
        content: "You are a strict conversation evaluator, not a companion. Score exactly three dimensions from 1 to 5: warmth, personaConsistency, and contextContinuity. Evaluate whether the reply fits the selected persona and latest user message without inventing facts. Do not reward generic flattery. Return only JSON with integer fields warmth, personaConsistency, contextContinuity and a short rationale string.",
      },
      {
        role: "user",
        content: JSON.stringify({ locale: input.locale, selectedPersona: input.persona, latestUser: input.user, reply: input.reply }),
      },
    ],
    mode: "non_stream",
    temperature: 0,
    requestId: input.requestId,
  });
  return parseScores(generated.text);
}

async function main() {
  const live = process.argv.includes("--live");
  const useJudge = process.argv.includes("--judge");
  const repeats = Math.max(1, Math.min(5, Number(arg("repeats") || 2)));
  if (!Number.isInteger(repeats)) throw new Error("--repeats must be an integer from 1 to 5");
  const locales = selected("locale", LOCALES, LOCALES);
  const genders = selected("gender", GENDERS, GENDERS);
  const personas = selected("persona", PERSONAS, PERSONAS);
  const scenarioId = arg("scenario");
  if (scenarioId && !scenarios.some((scenario) => scenario.id === scenarioId)) {
    throw new Error(`Unknown --scenario=${scenarioId}`);
  }
  const activeScenarios = scenarios.filter((scenario) => !scenarioId || scenario.id === scenarioId);
  const replyCount = locales.length * genders.length * personas.length * repeats
    * activeScenarios.reduce((total, scenario) => total + scenario.turns.en.length, 0);

  if (!live) {
    console.log(JSON.stringify({
      mode: "dry-run (no API calls)",
      locales,
      genders,
      personas,
      scenarios: activeScenarios.map((scenario) => scenario.id),
      repeats,
      syntheticReplies: replyCount,
      judgeCallsIfEnabled: useJudge ? replyCount : 0,
      note: "Use --live to run the synthetic evaluation. Add --judge for model-assisted rubric scores. Neither replaces human review.",
    }, null, 2));
    return;
  }

  const results: Array<Record<string, unknown>> = [];
  let completed = 0;
  for (const locale of locales) {
    for (const gender of genders) {
      for (const persona of personas) {
        for (const scenario of activeScenarios) {
          for (let repeat = 1; repeat <= repeats; repeat += 1) {
            const history: Message[] = [{ role: "system", content: systemPrompt(locale, gender, persona) }];
            for (let turnIndex = 0; turnIndex < scenario.turns[locale].length; turnIndex += 1) {
              const turn = scenario.turns[locale][turnIndex];
              if (turn.prior) history.push(...turn.prior);
              history.push({ role: "user", content: turn.user });
              const requestId = `persona-${locale}-${gender}-${persona}-${scenario.id}-r${repeat}-t${turnIndex + 1}`;
              let reply = "";
              let error: string | null = null;
              try {
                const generated = await generateCompanionText({
                  messages: history,
                  mode: "non_stream",
                  temperature: 0.7,
                  requestId,
                });
                reply = generated.text.trim();
              } catch (cause) {
                error = cause instanceof Error ? cause.name : "UnknownError";
              }
              const checks = evaluatePersonaReply({
                text: reply,
                locale,
                scenario: scenario.id,
                expectedFacts: scenario.expectedFacts?.[locale],
              });
              let scores: JudgeScores | null = null;
              let judgeError: string | null = null;
              if (useJudge && reply && !error) {
                try {
                  scores = await judgeReply({ locale, persona, user: turn.user, reply, requestId: `${requestId}-judge` });
                } catch (cause) {
                  judgeError = cause instanceof Error ? cause.message.slice(0, 160) : "Unknown judge error";
                }
              }
              results.push({
                id: requestId,
                locale,
                companionGender: gender,
                persona,
                scenario: scenario.id,
                repeat,
                turn: turnIndex + 1,
                syntheticUser: turn.user,
                syntheticReply: reply,
                error,
                hardChecks: checks,
                hardPassed: checks.every((check) => check.passed),
                judgeScores: scores,
                judgeError,
              });
              history.push({ role: "assistant", content: reply });
              completed += 1;
              console.log(`[${completed}/${replyCount}] ${requestId}: ${error ? "ERROR" : checks.every((check) => check.passed) ? "hard checks passed" : "hard checks FAILED"}`);
            }
          }
        }
      }
    }
  }

  const scored = results.flatMap((result) => result.judgeScores ? [result.judgeScores as JudgeScores] : []);
  const average = (key: keyof Pick<JudgeScores, "warmth" | "personaConsistency" | "contextContinuity">) =>
    scored.length ? Number((scored.reduce((sum, score) => sum + score[key], 0) / scored.length).toFixed(2)) : null;
  const report = {
    generatedAt: new Date().toISOString(),
    model: process.env.OPENAI_MODEL || "deepseek-v4-pro",
    fixtureDate: "2026-11-03",
    repeats,
    totalReplies: results.length,
    hardPassRate: results.length ? Number((results.filter((result) => result.hardPassed).length / results.length).toFixed(4)) : 0,
    averageJudgeScores: {
      warmth: average("warmth"),
      personaConsistency: average("personaConsistency"),
      contextContinuity: average("contextContinuity"),
    },
    interpretation: "Hard checks catch only specified failure patterns. Judge scores are model-assisted signals, not proof of a stable persona. Review the raw synthetic replies and repeat runs before drawing conclusions.",
    humanReview: {
      required: true,
      suggestedSample: "At least two repeats per persona and scenario, including every failed hard check and both genders in both languages.",
    },
    results,
  };
  const outputDir = path.resolve(process.cwd(), "eval-results");
  await mkdir(outputDir, { recursive: true });
  const output = path.join(outputDir, `persona-stability-${Date.now()}.json`);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, totalReplies: report.totalReplies, hardPassRate: report.hardPassRate, averageJudgeScores: report.averageJudgeScores }, null, 2));
  if (results.some((result) => !result.hardPassed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
