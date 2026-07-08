import { handleListBenchmarks } from "@/lib/http/benchmark-handler";
export const runtime = "nodejs";
export async function GET() { return handleListBenchmarks(); }
