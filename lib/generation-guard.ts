import { createServerAdminClient } from "@/lib/supabase";

type GuardClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Durable fairness controls, not a lifetime free-message quota. */
export async function withGenerationGuard(
  userId: string,
  run: () => Promise<Response>,
  client: GuardClient = createServerAdminClient(),
): Promise<Response> {
  const token = crypto.randomUUID();
  let result;
  try {
    result = await client.rpc("acquire_generation_slot", {
      p_user_id: userId, p_token: token,
      p_user_limit: limit("GENERATION_USER_PER_MINUTE", 12),
      p_global_limit: limit("GENERATION_GLOBAL_PER_MINUTE", 240),
      p_concurrency: 2,
    });
  } catch {
    result = { error: true, data: null };
  }
  if (result.error || typeof result.data?.allowed !== "boolean") {
    console.error("[generation-guard] shared protection unavailable");
    return Response.json({ error: "Service temporarily unavailable. Please try again shortly.", code: "PROTECTION_UNAVAILABLE" }, { status: 503 });
  }
  if (!result.data.allowed) {
    return Response.json({ error: "Please wait a moment before trying again.", code: "RATE_LIMITED" }, {
      status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      const { error } = await client.rpc("release_generation_slot", { p_user_id: userId, p_token: token });
      if (error) console.warn("[generation-guard] release failed; lease will expire");
    } catch { console.warn("[generation-guard] release failed; lease will expire"); }
  };
  try {
    const response = await run();
    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      await release();
      return response;
    }
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { await release(); controller.close(); }
          else controller.enqueue(value);
        } catch (error) { await release(); controller.error(error); }
      },
      async cancel(reason) {
        try { await reader.cancel(reason); } finally { await release(); }
      },
    }), { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    await release();
    throw error;
  }
}
