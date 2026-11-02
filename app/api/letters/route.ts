import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { LETTER_LIST_SELECT } from "@/lib/letter";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { data: letters, error } = await supabase
    .from("letters")
    .select(LETTER_LIST_SELECT)
    .eq("user_id", user.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[letters] storage unavailable", error.message);
    return NextResponse.json({ letters: [], unavailable: true });
  }
  return NextResponse.json({ letters: letters || [], unavailable: false });
}
