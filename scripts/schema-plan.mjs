import { readFileSync } from "node:fs";
const files = JSON.parse(
  readFileSync(new URL("../migrations/install-order.json", import.meta.url)),
);
const mode = process.argv[2];
if (!["fresh", "upgrade"].includes(mode))
  throw Error(
    "Choose fresh (empty Supabase database) or upgrade (launch_security already installed).",
  );
const plan =
  mode === "fresh"
    ? files
    : files.slice(files.indexOf("migrations/trusted_memory.sql"));
console.log("begin;");
if (mode === "upgrade")
  console.log(`do $$ begin
  if to_regprocedure('public.acquire_generation_slot(uuid,uuid,integer,integer,integer)') is null then
    raise exception 'Install the launch baseline before upgrading'; end if; end $$;`);
for (const name of plan) {
  const sql = readFileSync(new URL("../" + name, import.meta.url), "utf8");
  console.log(
    "-- " +
      name +
      "\n" +
      sql.replace(/^begin;\s*$/im, "").replace(/^commit;\s*$/im, ""),
  );
}
console.log("commit;");
