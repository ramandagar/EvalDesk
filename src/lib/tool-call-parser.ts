/**
 * Parse tool calls from various agent response formats.
 * Supports: OpenAI (function_call / tool_calls), Anthropic (tool_use), generic JSON
 */

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: string;
}

export function parseToolCalls(response: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  // Try parsing as JSON first (full response might be JSON)
  try {
    const json = JSON.parse(response);

    // OpenAI format: response has tool_calls array
    if (json.tool_calls && Array.isArray(json.tool_calls)) {
      for (const tc of json.tool_calls) {
        calls.push({
          name: tc.function?.name || tc.name || "unknown",
          arguments: typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {},
          result: tc.result,
        });
      }
      return calls;
    }

    // OpenAI legacy format: function_call
    if (json.function_call) {
      calls.push({
        name: json.function_call.name || "unknown",
        arguments: typeof json.function_call.arguments === "string" ? JSON.parse(json.function_call.arguments) : json.function_call.arguments || {},
      });
      return calls;
    }

    // Anthropic format: content blocks with tool_use type
    if (json.content && Array.isArray(json.content)) {
      for (const block of json.content) {
        if (block.type === "tool_use") {
          calls.push({
            name: block.name || "unknown",
            arguments: block.input || {},
          });
        }
      }
      if (calls.length > 0) return calls;
    }
  } catch {
    // Not valid JSON, try regex patterns
  }

  // Regex pattern: function_call("name", {args})
  const fnCallRegex = /(?:function_call|tool_call|call_tool|invoke)\s*\(\s*["']([^"']+)["']\s*,?\s*(\{[^}]*\})?/gi;
  let match;
  while ((match = fnCallRegex.exec(response)) !== null) {
    let args = {};
    try { args = JSON.parse(match[2] || "{}"); } catch { args = {}; }
    calls.push({ name: match[1], arguments: args });
  }

  // Regex pattern: "tool": "name", "arguments": {...}
  const jsonRegex = /"tool"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})/gi;
  while ((match = jsonRegex.exec(response)) !== null) {
    let args = {};
    try { args = JSON.parse(match[2]); } catch { args = {}; }
    calls.push({ name: match[1], arguments: args });
  }

  return calls;
}

export function evaluateToolCall(actual: ParsedToolCall, expected: { name: string; expectedArgs?: Record<string, any> }): boolean {
  if (actual.name !== expected.name) return false;
  if (expected.expectedArgs) {
    for (const [key, value] of Object.entries(expected.expectedArgs)) {
      if (actual.arguments[key] !== value) return false;
    }
  }
  return true;
}
