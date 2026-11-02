// 纯文本记忆可靠性规则：不依赖数据库、embedding 或模型，便于本地回归测试。
// 冲突时宁可少记，也不拼接、调和或编造第三条“新事实”。

export const TRANSIENT_MEMORY_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const NEAR_DUPLICATE_THRESHOLD = 0.86;

export type MemoryTextRelation = "exact" | "near" | "conflict" | "distinct";

// About You 只承载用户自身的事实。明显涉及陪伴体、助手推测或记忆纠正的
// 元互动应进入 relationship_events 或直接丢弃，不能成为用户事实记忆。
const NON_USER_SCOPED_MEMORY_PATTERN =
  /陪伴(?:角色|体|者)|AI\s*伴侣|\bamara\b|\bassistant\b|\bcompanion\b|(?:觉得|认为|猜测|怀疑)用户|纠正.*记忆|修正.*记忆|\bcorrect(?:ed|ing)?\b.*\bmemory\b/i;

export function isUserScopedMemoryText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && !NON_USER_SCOPED_MEMORY_PATTERN.test(value);
}

export interface MemoryTextMatch {
  index: number;
  relation: Exclude<MemoryTextRelation, "distinct">;
}

// 动态构造以兼容项目默认 ES5 target；运行环境仍使用 Unicode 属性匹配。
const MEMORY_NOISE_PATTERN = new RegExp("[\\p{P}\\p{Z}\\s]+", "gu");

/** 用于完全重复判断；保留否定词、数字和实体，避免把不同事实合并。 */
export function normalizeMemoryText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(MEMORY_NOISE_PATTERN, "")
    .trim();
}

// 只去掉明显的语气/程度修饰，不去掉会改变事实含义的词。
function comparisonText(value: string): string {
  return normalizeMemoryText(value).replace(/非常|特别|比较|真的|有点|有些|很|挺/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function bigramDice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

export function memoryTextSimilarity(a: string, b: string): number {
  const left = comparisonText(a);
  const right = comparisonText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const dice = bigramDice(left, right);
  // 避免长摘要的二次方编辑距离开销；bigram 仍可进行保守近似判断。
  if (Math.max(left.length, right.length) > 400) return dice;
  const edit = 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
  return Math.max(dice, edit);
}

function numericSignature(value: string): string[] {
  return normalizeMemoryText(value).match(/\d+(?:\.\d+)?/g) || [];
}

function hasNegativeOrEndedPolarity(value: string): boolean {
  return /不再|不喜欢|不|没有|没|无|讨厌|拒绝|戒掉|停止|结束|已完成|完成了/.test(normalizeMemoryText(value));
}

function sameLengthSingleSubstitution(a: string, b: string): boolean {
  if (a !== b && a.length === b.length && a.length <= 24) {
    return levenshteinDistance(a, b) === 1;
  }
  return false;
}

/**
 * 保守比较两条记忆。near 只用于明显复述；数字、否定/结束状态或短句关键实体
 * 发生变化时归为 conflict，调用方不得据此生成折中文本。
 */
export function classifyMemoryPair(candidate: string, existing: string): MemoryTextRelation {
  const normalizedCandidate = normalizeMemoryText(candidate);
  const normalizedExisting = normalizeMemoryText(existing);
  if (!normalizedCandidate || !normalizedExisting) return "distinct";
  if (normalizedCandidate === normalizedExisting) return "exact";
  if (comparisonText(candidate) === comparisonText(existing)) return "near";

  const similarity = memoryTextSimilarity(candidate, existing);
  const candidateNumbers = numericSignature(candidate);
  const existingNumbers = numericSignature(existing);
  const numbersDiffer =
    candidateNumbers.length > 0 &&
    existingNumbers.length > 0 &&
    candidateNumbers.join("|") !== existingNumbers.join("|");
  if (similarity >= 0.5 && numbersDiffer) return "conflict";
  if (
    similarity >= 0.5 &&
    hasNegativeOrEndedPolarity(candidate) !== hasNegativeOrEndedPolarity(existing)
  ) {
    return "conflict";
  }
  if (sameLengthSingleSubstitution(comparisonText(candidate), comparisonText(existing))) {
    return "conflict";
  }
  return similarity >= NEAR_DUPLICATE_THRESHOLD ? "near" : "distinct";
}

/** exact 优先；冲突优先于近似重复，避免用过期记录覆盖一条冲突的新陈述。 */
export function findMemoryTextMatch(candidate: string, existing: string[]): MemoryTextMatch | null {
  let nearMatch: MemoryTextMatch | null = null;
  for (let index = 0; index < existing.length; index += 1) {
    const relation = classifyMemoryPair(candidate, existing[index]);
    if (relation === "exact") return { index, relation };
    if (relation === "conflict") return { index, relation };
    if (relation === "near" && !nearMatch) nearMatch = { index, relation };
  }
  return nearMatch;
}

/** 输入顺序就是排序优先级；每组只保留排名最高的一条，不改写正文或分数。 */
export function dedupeMemoryEntries<T>(
  entries: T[],
  textOf: (entry: T) => string,
  shouldExclude: (entry: T) => boolean = () => false,
): T[] {
  const kept: T[] = [];
  for (const entry of entries) {
    const text = typeof textOf(entry) === "string" ? textOf(entry).trim() : "";
    if (!text || shouldExclude(entry)) continue;
    if (!findMemoryTextMatch(text, kept.map(textOf))) kept.push(entry);
  }
  return kept;
}

const TRANSIENT_MEMORY_PATTERN =
  /最近|这几天|这周|本周|今天|昨天|明天|目前|现在|正在|在忙|在赶|准备|打算|加班|考试|失眠|睡眠差|生病|感冒|发烧|咳嗽|生理期|月经|例假|\b(?:recently|these days|this week|today|yesterday|tomorrow|currently|right now|busy|preparing|planning|overtime|exams?|insomnia|sleep deprived|sleeping poorly|sick|ill|fever|cough|menstru\w*|on (?:my|their) period)\b/i;

/** 过期临时记忆只在召回时隐藏，不做硬删除；无效/未来时间不会被误判为过期。 */
export function isExpiredTransientMemory(
  text: string,
  timestamp: string | null | undefined,
  now = new Date(),
  ttlMs = TRANSIENT_MEMORY_TTL_MS,
): boolean {
  if (!TRANSIENT_MEMORY_PATTERN.test(text) || !timestamp) return false;
  const updatedAt = Date.parse(timestamp);
  const nowMs = now.getTime();
  if (!Number.isFinite(updatedAt) || !Number.isFinite(nowMs) || updatedAt > nowMs) return false;
  return nowMs - updatedAt > ttlMs;
}

/** 数组合并也遵守文本去重/冲突规则；非字符串值仅做稳定的 JSON 完全去重。 */
export function mergeMemoryArrays(oldValue: unknown, newValue: unknown, replace = false): unknown[] {
  const oldArray = Array.isArray(oldValue) ? oldValue : [];
  const newArray = Array.isArray(newValue) ? newValue : [];
  const result: unknown[] = [];
  for (const value of replace ? newArray : [...oldArray, ...newArray]) {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) continue;
      const existingStrings = result.filter((entry): entry is string => typeof entry === "string");
      if (!findMemoryTextMatch(text, existingStrings)) result.push(text);
      continue;
    }
    const serialized = JSON.stringify(value);
    if (!result.some((entry) => JSON.stringify(entry) === serialized)) result.push(value);
  }
  return result;
}
