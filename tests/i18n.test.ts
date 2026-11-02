import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE, isLocale, localeFromSetting } from "../lib/i18n";

test("a new visitor always starts in English", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(localeFromSetting(undefined), null);
  assert.equal(localeFromSetting(""), null);
});

test("only explicit UI selections are accepted", () => {
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(null), false);
});

test("account locale values normalize without using browser geography", () => {
  assert.equal(localeFromSetting("en"), "en");
  assert.equal(localeFromSetting("en-US"), "en");
  assert.equal(localeFromSetting("zh-CN"), "zh");
  assert.equal(localeFromSetting("ZH"), "zh");
  assert.equal(localeFromSetting("fr-FR"), null);
});
