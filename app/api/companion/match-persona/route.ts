import { getAuthUser } from "@/lib/auth";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { matchCompanionPersona } from "@/lib/persona-matching";
import { withGenerationGuard } from "@/lib/generation-guard";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body.companion_id !== "string") return Response.json({ error: "Invalid companion" }, { status: 400 });
  const supabase = await createRouteHandlerClient();
  return withGenerationGuard(user.id, () => matchCompanionPersona(supabase, user.id, body.companion_id));
}
