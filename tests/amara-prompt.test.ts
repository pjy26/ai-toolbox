import assert from "node:assert/strict";
import {
  buildFriendSystemPrompt,
  buildGreetingPrompt,
  buildLoverSystemPrompt,
  companionExpressionBlock,
  memoryGroundingBlock,
  type LoverPromptConfig,
} from "../lib/amara-prompt";
import { personaBlock, stageBlock, type PersonaType } from "../lib/amara-persona";

const LAST_CHAT_EN = "The last conversation was earlier today. Never say that the user has been away for days or that it has been a long time.";
const LAST_CHAT_ZH = "上次聊天就是今天。严禁说 TA 好几天没来、好久不见或很久没聊。";

const loverBase: LoverPromptConfig = {
  locale: "en",
  persona: "gentle",
  companion_gender: "男",
  nickname: "Alex",
  companion_name: "Amara",
  current_time: "Current local date and time: 2026-11-02, Monday, 20:00 (user timezone: UTC).",
  last_chat_context: LAST_CHAT_EN,
  relationship_stage: 20,
  emotion_state: { valence: 0.2, arousal: 0.4, tags: ["calm"] },
  user_profile: "Basic info: city: London",
  memory_summaries: "- Was preparing a presentation",
  user_gender: "女",
  live_state: { current_activity: "reading", mood: "calm", last_topic: "presentation" },
  events_text: "- Talked through a difficult presentation",
  veto_text: "- Care note: Was sleep deprived — Avoid late-night plans.",
};

function lover(overrides: Partial<LoverPromptConfig> = {}): string {
  return buildLoverSystemPrompt({ ...loverBase, ...overrides });
}

const tests: [string, () => void][] = [
  ["English lover prompt uses English persona, stage, and behavior instructions", () => {
    const prompt = lover();
    assert.match(prompt, /# Gentle and reassuring/);
    assert.match(prompt, /# Relationship stage: Early spark/);
    assert.match(prompt, /# Conversation continuity and voice/);
    assert.match(prompt, /natural spoken English/);
    assert.doesNotMatch(prompt, /# 人格内核|# 对话连续性与表达/);
  }],
  ["Chinese lover prompt retains natural Chinese persona and stage instructions", () => {
    const prompt = lover({ locale: "zh", last_chat_context: LAST_CHAT_ZH });
    assert.match(prompt, /# 温柔包容型/);
    assert.match(prompt, /# 关系阶段：暧昧期/);
    assert.match(prompt, /# 对话连续性与表达/);
    assert.match(prompt, /自然口语中文/);
  }],
  ["All four personas and relationship stages have both locales", () => {
    const personas: PersonaType[] = ["gentle", "playful", "quiet", "clingy"];
    for (const persona of personas) {
      assert.match(personaBlock(persona, "en"), /^# [A-Z]/);
      assert.match(personaBlock(persona, "zh"), /^# /);
      assert.ok(personaBlock(persona, "en") !== personaBlock(persona, "zh"));
      assert.match(lover({ persona }), new RegExp(personaBlock(persona, "en").split("\n")[0]));
    }
    for (const stage of [5, 40, 70, 95]) {
      assert.match(stageBlock(stage, "en"), /# Relationship stage:/);
      assert.match(stageBlock(stage, "zh"), /# 关系阶段：/);
    }
  }],
  ["Gender changes expression only and shares identical memory rules", () => {
    const male = companionExpressionBlock("男", "en");
    const female = companionExpressionBlock("女", "en");
    assert.notEqual(male, female);
    assert.match(male, /only natural self-description/);
    assert.match(female, /Do not use gender stereotypes/);
    assert.match(female, /same personality core.*honesty rules.*memory rules/);
    const sharedEn = memoryGroundingBlock("en");
    const sharedZh = memoryGroundingBlock("zh");
    assert.ok(lover({ companion_gender: "男" }).includes(sharedEn));
    assert.ok(lover({ companion_gender: "女" }).includes(sharedEn));
    assert.ok(lover({ locale: "zh", companion_gender: "男", last_chat_context: LAST_CHAT_ZH }).includes(sharedZh));
    assert.ok(lover({ locale: "zh", companion_gender: "女", last_chat_context: LAST_CHAT_ZH }).includes(sharedZh));
    assert.doesNotMatch(`${male}\n${female}`, /makeup|football|facial mask/i);
  }],
  ["AI identity is honest in lover and friend prompts", () => {
    for (const prompt of [
      lover(),
      lover({ locale: "zh", last_chat_context: LAST_CHAT_ZH }),
      buildFriendSystemPrompt({
        locale: "en",
        companion_gender: "女",
        nickname: "",
        user_profile: "",
        memory_summaries: "",
        current_time: "Current time",
        last_chat_context: LAST_CHAT_EN,
      }),
      buildFriendSystemPrompt({
        locale: "zh",
        companion_gender: "男",
        nickname: "",
        user_profile: "",
        memory_summaries: "",
        current_time: "当前时间",
        last_chat_context: LAST_CHAT_ZH,
      }),
    ]) {
      assert.match(prompt, /AI/);
      assert.doesNotMatch(prompt, /不承认自己是 AI|任何情况下不承认自己是 AI/);
    }
    assert.match(lover(), /I'm Amara, an AI companion/);
    assert.match(lover({ locale: "zh", last_chat_context: LAST_CHAT_ZH }), /我是 Amara，一个 AI 伴侣/);
  }],
  ["Memory, current conversation, and supplied last-chat constraints are explicit", () => {
    const prompt = lover();
    assert.ok(prompt.includes(LAST_CHAT_EN));
    assert.match(prompt, /only authoritative absence interval/);
    assert.match(prompt, /Never invent a fact about the user/);
    assert.match(prompt, /may be incomplete, wrong, or outdated/);
    assert.match(prompt, /current user message and conversation history come first/i);
    assert.match(prompt, /never restart the scene or mechanically recite memories/);
    assert.match(prompt, /Recent recorded state \(possibly outdated/);
    const zh = lover({ locale: "zh", last_chat_context: LAST_CHAT_ZH });
    assert.ok(zh.includes(LAST_CHAT_ZH));
    assert.match(zh, /绝不编造用户事实/);
    assert.match(zh, /可能不完整、有误或已经过期/);
    assert.match(zh, /唯一可信的间隔依据/);
  }],
  ["Crisis guidance is local and appropriate to locale", () => {
    const en = lover();
    assert.match(en, /local emergency services/);
    assert.match(en, /local crisis hotline/);
    assert.match(en, /do not assume they are in mainland China/i);
    assert.doesNotMatch(en, /010-82951332|400-161-9995/);
    const zh = lover({ locale: "zh", last_chat_context: LAST_CHAT_ZH });
    assert.match(zh, /010-82951332/);
    assert.match(zh, /400-161-9995/);
    assert.match(zh, /不默认 TA 在中国大陆/);
  }],
  ["English and Chinese greetings share grounding and gender expression", () => {
    const en = buildGreetingPrompt({
      locale: "en",
      persona: "playful",
      companion_gender: "女",
      companion_name: "Amara",
      relationship_type: "lover",
      relationship_stage: 40,
      current_time: "Current local time",
      last_chat_context: LAST_CHAT_EN,
      live_state: { last_topic: "presentation" },
      user_profile: "Name: Alex",
      memory_summaries: "- Was preparing a presentation",
      is_member: true,
    });
    assert.match(en, /# Playful and warm/);
    assert.match(en, /# Relationship stage: In love/);
    assert.match(en, /Exactly one short sentence in natural, conversational English/);
    assert.match(en, /Do not pretend to remember|Never invent a fact/);
    assert.ok(en.includes(LAST_CHAT_EN));
    const zh = buildGreetingPrompt({
      locale: "zh",
      persona: "quiet",
      companion_gender: "男",
      companion_name: "Amara",
      relationship_type: "friend",
      relationship_stage: 5,
      current_time: "当前时间",
      last_chat_context: LAST_CHAT_ZH,
      live_state: null,
      user_profile: "",
      memory_summaries: "",
      is_member: false,
    });
    assert.match(zh, /# 安静细腻型/);
    assert.match(zh, /只能一句简短、自然、口语化的中文/);
    assert.match(zh, /不要假装记得具体事实或共同经历/);
    assert.ok(zh.includes(LAST_CHAT_ZH));
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
console.log(`\n${passed}/${tests.length} prompt tests passed.`);
