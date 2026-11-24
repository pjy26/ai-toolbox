/** A dropped connection before DONE is retryable using the same turn ID. */
export async function readSavedReply(
  response: Response,
  fallback: string,
  onChunk?: (delta: string, fullText: string) => void,
): Promise<string> {
  let text = "";
  let sawDone = false;

  const parseLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const raw = line.slice(6).trim();
    if (raw === "[DONE]") {
      sawDone = true;
      return;
    }
    const event = JSON.parse(raw);
    if (event.error) throw Error(event.error);
    const delta = event.choices?.[0]?.delta?.content || "";
    if (delta) {
      text += delta;
      onChunk?.(delta, text);
    }
  };

  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          parseLine(line);
          if (sawDone && text) return text;
        }
      }
      buffer += decoder.decode();
      if (buffer) {
        for (const line of buffer.split(/\r?\n/)) {
          parseLine(line);
          if (sawDone && text) return text;
        }
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const body = await response.text();
    for (const line of body.split(/\r?\n/)) {
      parseLine(line);
      if (sawDone && text) return text;
    }
  }

  if (sawDone && text) return text;
  throw Error(fallback);
}
