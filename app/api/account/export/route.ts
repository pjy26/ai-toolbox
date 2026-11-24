import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createServerAdminClient } from "@/lib/supabase";
import { buildAccountExport } from "@/lib/account-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const result = await buildAccountExport(createServerAdminClient(), user);
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="amara-data-${result.exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch {
    console.error("[account-export] export failed");
    return NextResponse.json({ error: "Your data export is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
