import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getWaffoClient, waffoStoreId } from "@/lib/waffo";

export const runtime = "nodejs";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  try {
    const { portalUrl } = await getWaffoClient().auth.createCustomerPortalLink({
      storeId: waffoStoreId(),
      buyerIdentity: user.id,
    });
    return NextResponse.json({ portalUrl }, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    console.error("Waffo customer portal creation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The membership portal is temporarily unavailable." }, { status: 503 });
  }
}
