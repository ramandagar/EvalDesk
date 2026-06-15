// ============================================================================
// Cursor pagination — PURE. A cursor encodes the keyset position [createdAtMs,
// id] plus the org + resource it was issued for. On decode we REJECT a cursor
// whose org/resource doesn't match the caller, so a cursor can't be replayed
// across tenants or endpoints (an IDOR vector otherwise). Order is always
// (created_at, id) with the CUID2 id as a collision-free tiebreaker, and
// created_at is epoch-ms so SQLite and Postgres sort identically.
// ============================================================================

export interface CursorKey {
  createdAt: number;
  id: string;
}

interface CursorPayload {
  k: [number, string]; // [createdAtMs, id]
  o: string; // orgId
  r: string; // resource
}

export class CursorError extends Error {
  readonly status = 400; // mapped to HTTP 400 by errorResponse
  constructor(message: string) {
    super(message);
    this.name = "CursorError";
  }
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function encodeCursor(key: CursorKey, orgId: string, resource: string): string {
  const payload: CursorPayload = { k: [key.createdAt, key.id], o: orgId, r: resource };
  return b64urlEncode(JSON.stringify(payload));
}

/** Decode + validate a cursor against the caller's org/resource. Throws on mismatch. */
export function decodeCursor(cursor: string, orgId: string, resource: string): CursorKey {
  let payload: CursorPayload;
  try {
    payload = JSON.parse(b64urlDecode(cursor)) as CursorPayload;
  } catch {
    throw new CursorError("Malformed cursor");
  }
  if (
    !payload ||
    !Array.isArray(payload.k) ||
    payload.k.length !== 2 ||
    typeof payload.k[0] !== "number" ||
    typeof payload.k[1] !== "string"
  ) {
    throw new CursorError("Malformed cursor");
  }
  if (payload.o !== orgId) throw new CursorError("Cursor does not belong to this organization");
  if (payload.r !== resource) throw new CursorError("Cursor is for a different resource");
  return { createdAt: payload.k[0], id: payload.k[1] };
}

export interface Page<T> {
  data: T[];
  page: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function clampLimit(requested: number | undefined): number {
  if (!requested || requested < 1) return DEFAULT_LIMIT;
  return Math.min(requested, MAX_LIMIT);
}

/**
 * Build a Page from an over-fetched row set. Pass `limit + 1` rows; if the extra
 * row is present there are more, and the next cursor is built from the LAST kept
 * row. `keyOf` extracts the keyset position from a row.
 */
export function buildPage<T>(rows: T[], limit: number, orgId: string, resource: string, keyOf: (row: T) => CursorKey): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(keyOf(last), orgId, resource) : null;
  return { data, page: { nextCursor, hasMore, limit } };
}
