const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const { randomUUID } = require("node:crypto");
const { join } = require("node:path");

test("launch migration enforces browser permissions and durable generation limits", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.profiles (
        id uuid primary key, username text, gender text, avatar_url text, credits integer,
        membership_type text default 'free', membership_expires_at timestamptz,
        manual_membership_type text, manual_membership_expires_at timestamptz
      );
      create table public.orders (id uuid primary key, user_id uuid, status text, amount numeric);
      create function public.deduct_credits(uuid, integer) returns void language sql as 'select';
      grant all on public.profiles, public.orders to anon, authenticated;
      grant update (membership_type) on public.profiles to authenticated;
      insert into public.profiles(id, username) values ('11111111-1111-4111-8111-111111111111', 'before');
    `);
    const migration = readFileSync(join(__dirname, "../migrations/launch_security.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration); // Safe to reapply without reopening privileges.
    await db.exec("set role authenticated");
    await db.exec("update public.profiles set username = 'after', gender = '保密'");
    await assert.rejects(db.exec("update public.profiles set membership_type = 'plus_yearly'"), /permission denied/);
    await assert.rejects(db.exec("update public.profiles set manual_membership_expires_at = now() + interval '1 year'"), /permission denied/);
    await assert.rejects(db.exec("insert into public.orders(id, status) values (gen_random_uuid(), 'paid')"), /permission denied/);
    await assert.rejects(db.exec("truncate public.profiles"), /permission denied/);
    await assert.rejects(db.exec("select public.deduct_credits(gen_random_uuid(), -1000)"), /permission denied/);
    await assert.rejects(db.query("select public.acquire_generation_slot($1,$2)", [randomUUID(), randomUUID()]), /permission denied/);
    await db.exec("reset role; set role service_role");
    await db.exec("update public.profiles set membership_type = 'plus_monthly'");
    await db.exec("insert into public.orders(id, status) values (gen_random_uuid(), 'paid')");

    const user = randomUUID();
    const acquire = async (u = user, userLimit = 12, globalLimit = 240) => {
      const token = randomUUID();
      const result = await db.query("select public.acquire_generation_slot($1,$2,$3,$4,2) as result", [u, token, userLimit, globalLimit]);
      return { ...result.rows[0].result, token };
    };
    const first = await acquire();
    const second = await acquire();
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal((await acquire()).allowed, false, "third concurrent generation is rejected");
    await db.query("select public.release_generation_slot($1,$2)", [user, first.token]);
    assert.equal((await acquire()).allowed, true, "finished request frees a slot");
    await db.query("update public.generation_guards set leases = '{}' where bucket = $1", ["user:" + user]);
    assert.equal((await acquire(user, 3)).allowed, false, "per-minute count survives slot release");
    const other = randomUUID();
    assert.equal((await acquire(other)).allowed, true, "different accounts have independent user limits");
    assert.equal((await acquire(randomUUID(), 12, 1)).allowed, false, "global cap spans accounts");
    await db.exec("update public.generation_guards set window_start = now() - interval '2 minutes', leases = jsonb_build_object('stale', now() - interval '1 second')");
    assert.equal((await acquire()).allowed, true, "new minute and expired leases recover automatically");
  } finally {
    await db.close();
  }
});
