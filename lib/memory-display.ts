import type { Locale } from "@/lib/i18n";

const labels: Record<string, { zh: string; en: string }> = {
  name: { zh: "名字", en: "Name" },
  nickname: { zh: "喜欢的称呼", en: "Preferred name" },
  gender: { zh: "性别", en: "Gender" },
  age: { zh: "年龄", en: "Age" },
  birthday: { zh: "生日", en: "Birthday" },
  city: { zh: "所在城市", en: "City" },
  location: { zh: "所在地方", en: "Location" },
  language: { zh: "常用语言", en: "Language" },
  occupation: { zh: "职业", en: "Occupation" },
  food: { zh: "喜欢的食物", en: "Favorite food" },
  drink: { zh: "喜欢的饮料", en: "Favorite drink" },
  hobby: { zh: "爱好", en: "Hobby" },
  hobbies: { zh: "爱好", en: "Hobbies" },
};

const values: Record<string, { zh: string; en: string }> = {
  male: { zh: "男性", en: "Male" },
  female: { zh: "女性", en: "Female" },
  "non-binary": { zh: "非二元性别", en: "Non-binary" },
};

/** Profile keys stay canonical in storage; only the console presentation is localized. */
export function displayMemoryText(summary: string, locale: Locale): string {
  const match = summary.match(/^([A-Za-z][A-Za-z0-9_ -]{0,60}):\s*([\s\S]+)$/);
  if (!match) return summary;
  const [, rawKey, rawValue] = match;
  const key = rawKey.trim().toLowerCase().replaceAll(" ", "_");
  const label = labels[key]?.[locale] || (locale === "zh"
    ? "关于你的细节"
    : rawKey.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const value = values[rawValue.trim().toLowerCase()]?.[locale] || rawValue;
  return `${label} · ${value}`;
}
