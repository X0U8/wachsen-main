/**
 * Streams an SSE response from /api/ask-question and calls onProgress with a
 * real count of completed JSON objects detected in the accumulating buffer.
 *
 * How counting works:
 *  - Each question object in the JSON array ends with `}` followed by either
 *    `,` (more items) or `]` (end of array), optionally with whitespace.
 *  - We count the number of such closing patterns in the growing buffer to
 *    derive an accurate "N questions generated so far" number.
 *
 * Returns the fully assembled plain-text reply extracted from SSE delta chunks.
 */
export async function streamConceptCards(
  body: Record<string, unknown>,
  onProgress: (count: number) => void
): Promise<string> {
  const response = await fetch('/api/ask-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      `${(errData as any).error || 'Failed to generate flashcards'} (${(errData as any).details || ''})`
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBuffer = '';

  // Regex that detects the end of a complete JSON object inside the array:
  // a closing } followed optionally by whitespace then , or ]
  const objectEndPattern = /\}\s*[,\]]/g;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode the raw SSE chunk (may contain multiple lines)
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    // Parse SSE lines: each data line looks like  "data: {...}"
    const lines = buffer.split('\n');
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        textBuffer += delta;
      } catch {
        // Incomplete JSON fragment — skip
      }
    }

    // Count how many question objects are fully present in the accumulated text
    const matches = textBuffer.match(objectEndPattern);
    const count = matches ? matches.length : 0;
    onProgress(Math.min(count, 10));
  }

  return textBuffer;
}
