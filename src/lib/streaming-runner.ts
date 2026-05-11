/**
 * Streaming runner — executes agent calls and streams results via SSE.
 */

export interface StreamingChunk {
  type: "token" | "tool_call" | "status" | "complete" | "error";
  data: string;
  timestamp: number;
}

/**
 * Create an SSE response that wraps an async evaluation.
 * The evaluator function should return the agent response string.
 */
export function createStreamingResponse(
  evaluator: () => Promise<string>
): Response {
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: StreamingChunk) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      send({ type: "status", data: "connecting", timestamp: startTime });

      try {
        const response = await evaluator();

        // Emit the full response as a token chunk
        send({ type: "token", data: response, timestamp: Date.now() });

        send({
          type: "complete",
          data: JSON.stringify({ responseTime: Date.now() - startTime }),
          timestamp: Date.now(),
        });
      } catch (error: any) {
        send({
          type: "error",
          data: error.message || "Agent call failed",
          timestamp: Date.now(),
        });
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
