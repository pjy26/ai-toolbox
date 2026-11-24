export const MAX_CHAT_MESSAGE_LENGTH = 4_000;
export const MAX_CHAT_BODY_BYTES = 128_000;

/** Limit streamed bodies too; Content-Length alone is client-controlled. */
export async function readChatInput(req: Request): Promise<Record<string, any> | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CHAT_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const input = JSON.parse(new TextDecoder().decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    if (typeof input.message !== "string" || !input.message.trim()
      || input.message.length > MAX_CHAT_MESSAGE_LENGTH) return null;
    if (input.client_turn_id !== undefined && (typeof input.client_turn_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.client_turn_id))) return null;
    // Server-owned persisted history is authoritative.
    delete input.history;
    return input;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
