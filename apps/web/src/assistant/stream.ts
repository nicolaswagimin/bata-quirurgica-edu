// NDJSON client for POST /assistant/chat. Must not import lib/firebase.tsx or read import.meta.env:
// unit tests import it in Node. The caller injects the API base URL and the Firebase ID token.
import {
  type ChatMessage,
  messageForStatus,
  type StreamEvent,
  StreamEventSchema,
} from '@bata/shared/schemas';

export class StreamHttpError extends Error {
  constructor(readonly status: number) {
    super(messageForStatus(status));
    this.name = 'StreamHttpError';
  }
}

function parseLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return StreamEventSchema.parse(JSON.parse(trimmed));
}

// Yields each complete line as a validated event; a trailing partial line waits for more bytes.
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const event = parseLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event) yield event;
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    const last = parseLine(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export type StreamChatOptions = {
  baseUrl: string;
  idToken: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
};

export async function streamChat(
  { baseUrl, idToken, messages, signal }: StreamChatOptions,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${baseUrl}/assistant/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) throw new StreamHttpError(res.ok ? 500 : res.status);
  for await (const event of readNdjson(res.body)) onEvent(event);
}
