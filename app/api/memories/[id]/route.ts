import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createServerAdminClient } from "@/lib/supabase";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import {
  parseProfileMemoryId,
  PROFILE_MEMORY_PREFIX,
} from "@/lib/memory-records";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const db = await createRouteHandlerClient();
  const { data: memory, error } = await db
    .from("memory_summaries")
    .select(
      "source_message_id,source_session_id,companion_id,provenance,revision",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !memory)
    return NextResponse.json(
      { error: "Memory unavailable" },
      { status: error ? 503 : 404 },
    );
  let source = null;
  if (memory.source_message_id && memory.source_session_id) {
    const { data, error } = await db
      .from("chat_messages")
      .select("id,content,created_at,chat_sessions!inner(companion_id,user_id)")
      .eq("id", memory.source_message_id)
      .eq("session_id", memory.source_session_id)
      .eq("role", "user")
      .eq("chat_sessions.companion_id", memory.companion_id)
      .eq("chat_sessions.user_id", user.id)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { error: "Source unavailable" },
        { status: 503 },
      );
    if (data)
      source = { messageId: data.id, text: data.content, at: data.created_at };
  }
  const versions = await createServerAdminClient()
    .from("memory_versions")
    .select("revision,summary,created_at,companions!inner(user_id)")
    .eq("companions.user_id", user.id)
    .eq("companion_id", memory.companion_id)
    .eq("memory_id", id)
    .eq("status", "superseded")
    .order("revision", { ascending: false })
    .limit(10);
  if (versions.error)
    return NextResponse.json({ error: "History unavailable" }, { status: 503 });
  const history = (versions.data || []).map(({ revision, summary }) => ({
    revision,
    summary,
  }));
  return NextResponse.json(
    {
      source,
      history,
      provenance: memory.provenance,
      revision: memory.revision,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

async function change(req: Request, { params }: RouteContext, forget: boolean) {
  const user = await getAuthUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (
    !forget &&
    (typeof body?.text !== "string" ||
      !body.text.trim() ||
      body.text.trim().length > 1000)
  ) {
    return NextResponse.json({ error: "Invalid correction" }, { status: 400 });
  }
  const db = createServerAdminClient();
  const text = forget ? null : body.text.trim();
  const profile = parseProfileMemoryId(id);
  if (id.startsWith(PROFILE_MEMORY_PREFIX) && !profile)
    return NextResponse.json({ error: "Invalid memory ID" }, { status: 400 });
  if (
    !forget &&
    (profile
      ? !Number.isFinite(Date.parse(body.updated_at))
      : !Number.isInteger(body.revision))
  ) {
    return NextResponse.json({ error: "Missing version" }, { status: 400 });
  }
  const result = profile
    ? await db.rpc("edit_profile_fact", {
        p_user: user.id,
        p_companion: profile.companionId,
        p_path: profile.path.map(String),
        p_at: body?.updated_at || null,
        p_text: text,
        p_expected: body?.expectedValue ?? null,
      })
    : await db.rpc("edit_trusted_memory", {
        p_user: user.id,
        p_memory: id,
        p_revision: body?.revision ?? null,
        p_text: text,
      });
  if (result.error)
    return NextResponse.json(
      { error: "Memory storage unavailable" },
      { status: 503 },
    );
  if (result.data !== "ok")
    return NextResponse.json(
      { error: result.data },
      {
        status:
          result.data === "missing"
            ? 404
            : result.data === "conflict"
              ? 409
              : 400,
      },
    );
  return NextResponse.json({ ok: true });
}
export const PATCH = (req: Request, ctx: RouteContext) =>
  change(req, ctx, false);
export const DELETE = (req: Request, ctx: RouteContext) =>
  change(req, ctx, true);
