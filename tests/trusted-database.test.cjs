const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { PGlite } = require("@electric-sql/pglite");
const { vector } = require("@electric-sql/pglite-pgvector");
const plan = (mode) =>
  execFileSync(process.execPath, ["scripts/schema-plan.mjs", mode], {
    encoding: "utf8",
  });

test("clean install and upgrade preserve legacy data; retries, evidence, correction and forgetting are atomic", async () => {
  const db = new PGlite({ extensions: { vector } });
  const rows = async (q, params = []) => (await db.query(q, params)).rows;
  const one = async (q, params = []) => (await rows(q, params))[0];
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 alter default privileges in schema public grant all on tables to service_role, authenticated, anon;`);
    const fresh = plan("fresh"),
      cut = fresh.indexOf("-- migrations/trusted_memory.sql");
    await db.exec(fresh.replace(/commit;\s*$/, "rollback;"));
    await db.exec(fresh.slice(0, cut) + "commit;");
    const u = randomUUID(),
      c = randomUUID(),
      id = randomUUID(),
      lease = randomUUID(),
      legacy = randomUUID();
    await db.query(
      "insert into auth.users values ($1,'local@example.test','{}')",
      [u],
    );
    await db.query(
      "insert into companions(id,user_id,relationship_type) values($1,$2,'lover')",
      [c, u],
    );
    await db.query(
      "insert into memory_summaries(id,companion_id,summary) values($1,$2,'Old note')",
      [legacy, c],
    );
    await db.exec(plan("upgrade"));
    await db.exec(plan("upgrade"));
    assert.equal(
      (
        await one("select provenance from memory_summaries where id=$1", [
          legacy,
        ])
      ).provenance,
      "legacy",
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select * from claim_memory_turn(null)"),
      /permission denied/,
    );
    await db.exec("reset role;set role service_role");
    const begin = (turn, token, msg = "I live in Shanghai.", sid = null) =>
      one("select begin_companion_turn($1,$2,$3,$4,$5,'en',$6) as t", [
        turn,
        u,
        c,
        sid,
        msg,
        token,
      ]).then((r) => r.t);
    const t = await begin(id, lease);
    assert.equal(t.state, "claimed");
    assert.equal((await begin(id, randomUUID())).state, "busy");
    assert.equal(
      (await begin(id, randomUUID(), "Different payload")).state,
      "conflict",
    );
    await assert.rejects(
      db.query("select finish_companion_turn($1,$2,'stale reply')", [
        id,
        randomUUID(),
      ]),
    );
    await db.query("select finish_companion_turn($1,$2,'saved reply')", [
      id,
      lease,
    ]);
    assert.equal((await begin(id, randomUUID())).reply, "saved reply");
    assert.equal((await one("select count(*)::int n from chat_messages")).n, 2);
    const apply = async (turn, facts) => {
      const task = await one("select * from claim_memory_turn($1)", [turn]);
      assert.equal(
        (await rows("select * from claim_memory_turn($1)", [turn])).length,
        0,
      );
      await db.query("select apply_turn_memory($1,$2,$3)", [
        turn,
        task.job_lease,
        JSON.stringify({ facts, people: [] }),
      ]);
      assert.equal(
        (await rows("select * from claim_memory_turn($1)", [turn])).length,
        0,
      );
    };
    await apply(id, [
      { key: "residence", quote: "I live in Shanghai." },
      { key: "fake", quote: "Paris" },
    ]);
    const first = await one(
      "select * from memory_summaries where memory_key='residence'",
    );
    assert.equal(first.source_message_id, t.message_id);
    assert.equal(
      (await rows("select id from memory_summaries where memory_key='fake'"))
        .length,
      0,
    );
    const queryVector = JSON.stringify([1,...Array(1023).fill(0)]);
    await db.query("update memory_summaries set embedding=$1::vector where id=$2",[queryVector,first.id]);
    const hits=await rows("select summary from match_memory_summaries($1,$2::vector)",[c,queryVector]);
    assert.equal(hits[0].summary,"I live in Shanghai.");
    const again=randomUUID(), againLease=randomUUID();
    await begin(again,againLease,"I live in Shanghai.",t.session_id);
    await db.query("select finish_companion_turn($1,$2,'noted')",[again,againLease]);
    await apply(again,[{key:"residence",quote:"I live in Shanghai."}]);
    assert.equal((await one("select count(*)::int n from memory_evidence where memory_id=$1",[first.id])).n,2);
    const id2 = randomUUID(),
      l2 = randomUUID();
    await begin(id2, l2, "I moved to Hangzhou.", t.session_id);
    await db.query("select finish_companion_turn($1,$2,'ok')", [id2, l2]);
    await apply(id2, [{ key: "residence", quote: "I moved to Hangzhou." }]);
    const edit = (owner, version, text) =>
      one("select edit_trusted_memory($1,$2,$3,$4) as result", [
        owner,
        first.id,
        version,
        text,
      ]).then((r) => r.result);
    assert.equal(await edit(randomUUID(), 2, "Other"), "missing");
    assert.equal(await edit(u, 1, "Stale"), "conflict");
    assert.equal(await edit(u, 2, "Now in Suzhou"), "ok");
    assert.equal(
      (
        await one("select summary from memory_summaries where id=$1", [
          first.id,
        ])
      ).summary,
      "Now in Suzhou",
    );
    assert.equal(await edit(u, 3, null), "ok");
    assert.equal(
      (await rows("select * from memory_summaries where id=$1", [first.id]))
        .length,
      0,
    );
    assert.equal(
      (await rows("select * from memory_versions where summary is not null"))
        .length,
      0,
    );
    const next = randomUUID();
    await begin(next, randomUUID(), "Next topic", t.session_id);
    assert.equal(
      (await rows("select * from turn_history($1,$2)", [next, u])).length,
      0,
    );
    const pending = randomUUID(),
      pendingLease = randomUUID();
    await begin(pending, pendingLease, "I live in Paris.", t.session_id);
    await db.query("select finish_companion_turn($1,$2,'ok')", [
      pending,
      pendingLease,
    ]);
    const running = await one("select * from claim_memory_turn($1)", [pending]);
    await db.exec("reset role");
    await db.query(
      "insert into user_settings(user_id,memory_enabled) values($1,false) on conflict(user_id) do update set memory_enabled=false",
      [u],
    );
    await assert.rejects(
      db.query("select apply_turn_memory($1,$2,$3)", [
        pending,
        running.job_lease,
        JSON.stringify({
          facts: [{ key: "residence", quote: "I live in Paris." }],
        }),
      ]),
    );
    assert.equal(
      (await one("select job_state from chat_turns where id=$1", [pending]))
        .job_state,
      "done",
    );
    const off = randomUUID(),
      offLease = randomUUID();
    await begin(off, offLease, "Private", t.session_id);
    await db.query("select finish_companion_turn($1,$2,'ok')", [off, offLease]);
    assert.equal(
      (await rows("select * from claim_memory_turn($1)", [off])).length,
      0,
    );
    await db.query(
      "update user_profiles set profile=$1 where companion_id=$2",
      [
        JSON.stringify({
          basic_info: { city: "Shanghai" },
          key_facts: ["one", "two"],
        }),
        c,
      ],
    );
    const at = (
      await one(
        "select updated_at::text at from user_profiles where companion_id=$1",
        [c],
      )
    ).at;
    assert.equal(
      (
        await one(
          "select edit_profile_fact($1,$2,array['basic_info','city'],$3,'Hangzhou',null) as result",
          [u, c, at],
        )
      ).result,
      "ok",
    );
    assert.equal(
      (
        await one(
          "select profile#>>'{basic_info,city}' city from user_profiles where companion_id=$1",
          [c],
        )
      ).city,
      null,
    );
    assert.equal(
      (
        await one(
          "select count(*)::int n from memory_summaries where provenance='user_edit' and summary='Hangzhou'",
        )
      ).n,
      1,
    );
    assert.equal(
      (
        await one(
          "select edit_profile_fact($1,$2,array['key_facts','0'],null,null,$3) result",
          [u, c, JSON.stringify("one")],
        )
      ).result,
      "ok",
    );
    assert.equal(
      (
        await one(
          "select edit_profile_fact($1,$2,array['key_facts','1'],null,null,$3) result",
          [u, c, JSON.stringify("two")],
        )
      ).result,
      "ok",
    );
  } finally {
    await db.close();
  }
});
