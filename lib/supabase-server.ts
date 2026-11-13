import { cookies } from "next/headers";
import { createRouteHandlerClient as createLegacyClient } from "@supabase/auth-helpers-nextjs";

// Resolve Next's async cookie store before handing it to the existing adapter.
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  // This adapter calls context.cookies().get/set synchronously at runtime.
  // Its declaration imports Next's new async signature; bridge that declaration
  // only, while preserving the existing browser/middleware cookie encoding.
  return createLegacyClient({ cookies: (() => cookieStore) as unknown as typeof cookies });
}
