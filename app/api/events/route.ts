import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { isClientProductEventName, recordProductEvent, type ProductEventDetails } from "@/lib/product-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: { eventName?: unknown; companionId?: unknown; locale?: unknown; details?: ProductEventDetails };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }
  if (!isClientProductEventName(body.eventName)) return NextResponse.json({ error: "Event must be recorded by the server." }, { status: 400 });
  if (body.companionId !== null && body.companionId !== undefined && typeof body.companionId !== "string") {
    return NextResponse.json({ error: "Invalid companion." }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const companionId = typeof body.companionId === "string" ? body.companionId : null;
  if (companionId) {
    const { data: owned, error } = await supabase
      .from("companions").select("id").eq("id", companionId).eq("user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not verify companion." }, { status: 500 });
    if (!owned) return NextResponse.json({ error: "Companion not found." }, { status: 404 });
  }

  const recorded = await recordProductEvent(supabase, user.id, body.eventName, {
    companionId,
    locale: typeof body.locale === "string" ? body.locale : undefined,
    details: body.details,
  });
  return NextResponse.json({ ok: recorded }, { status: recorded ? 202 : 503 });
}
