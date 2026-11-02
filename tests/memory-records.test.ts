import assert from "node:assert/strict";
import { deleteProfileMemory, listMemoryRecords, parseProfileMemoryId } from "../lib/memory-records";

const NOW = new Date("2026-11-02T12:00:00Z");
const companionId = "11111111-1111-4111-8111-111111111111";

function listMock() {
  const profile = {
    basic_info: { city: "Shanghai" },
    preferences: { drink: "Iced americano" },
    important_people: [{ name: "Lin", relation: "sister" }],
    ongoing_matters: ["Preparing a presentation"],
    personality_notes: "Prefers a gentle pace",
    key_facts: ["Uses public transport"],
  };
  const summaries = [
    { id: "s1", companion_id: companionId, summary: "Recently had insomnia", importance: 4, source_session_id: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    { id: "s2", companion_id: companionId, summary: "Likes quiet weekends", importance: 3, source_session_id: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
    { id: "s3", companion_id: companionId, summary: "用户对陪伴角色表达了爱意", importance: 5, source_session_id: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
    { id: "s4", companion_id: companionId, summary: "陪伴角色觉得用户在想念自己", importance: 5, source_session_id: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
    { id: "s5", companion_id: companionId, summary: "用户纠正了陪伴角色保存的旧记忆", importance: 5, source_session_id: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  ];
  return {
    from(table: string) {
      const query: any = {
        select: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: any) => unknown) => resolve({
          data: table === "user_profiles" ? [{ companion_id: companionId, profile, updated_at: "2026-11-01T00:00:00Z" }] : summaries,
          error: null,
        }),
      };
      return query;
    },
  };
}

async function main() {
  const records = await listMemoryRecords(listMock(), [companionId], NOW);
  const texts = records.map((record) => record.summary);
  assert.ok(texts.includes("drink: Iced americano"));
  assert.ok(texts.includes("Preparing a presentation"));
  assert.ok(texts.includes("Prefers a gentle pace"));
  assert.ok(texts.includes("Uses public transport"));
  assert.ok(texts.includes("Likes quiet weekends"));
  assert.ok(!texts.includes("Recently had insomnia"), "Expired transient memories stay hidden in both chat and console");
  assert.ok(!texts.some((text) => text.includes("陪伴角色")), "Companion interactions and inferences stay out of About You");
  assert.ok(!texts.some((text) => text.includes("Lin")), "People stay in their dedicated console section");
  assert.ok(records.every((record) => record.record_type === "summary" || record.record_type === "profile"));

  const preference = records.find((record) => record.summary === "drink: Iced americano")!;
  assert.deepEqual(parseProfileMemoryId(preference.id), { companionId, path: ["preferences", "drink"] });
  assert.equal(parseProfileMemoryId("not-a-profile-id"), null);

  let writtenProfile: any = null;
  const deleteMock = {
    from(table: string) {
      if (table === "companions") {
        const query: any = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { id: companionId }, error: null }),
        };
        return query;
      }
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { profile: { preferences: { drink: "Iced americano", food: "Noodles" } } }, error: null }),
        update: (value: any) => {
          writtenProfile = value.profile;
          return { eq: async () => ({ error: null }) };
        },
      };
      return query;
    },
  };
  const removed = await deleteProfileMemory(deleteMock, "user-1", preference.id);
  assert.deepEqual(removed, { ok: true });
  assert.deepEqual(writtenProfile, { preferences: { food: "Noodles" } });

  console.log("✓ Unified profile and summary records are visible to the console");
  console.log("✓ Expired transient records and dedicated people records are excluded");
  console.log("✓ Profile memory IDs round-trip and delete only the selected detail");
  console.log("\n3/3 memory record tests passed.");
}

void main();
