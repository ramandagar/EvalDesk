import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { createId } from "@/lib/utils";
import { db } from "@/db";
import { judgeTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DOMAIN_TEMPLATES } from "@/lib/judge-templates";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");

  let templates;
  if (domain) {
    templates = await db.select().from(judgeTemplates).where(eq(judgeTemplates.domain, domain));
  } else {
    templates = await db.select().from(judgeTemplates);
  }

  // If no templates exist yet, seed defaults
  if (templates.length === 0) {
    for (const t of DOMAIN_TEMPLATES) {
      await db.insert(judgeTemplates).values({ ...t, isOfficial: true });
    }
    templates = await db.select().from(judgeTemplates);
  }

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { domain, name, description, criteria, passThreshold } = body;
    if (!domain || !name || !criteria) {
      return NextResponse.json({ error: "domain, name, criteria required" }, { status: 400 });
    }

    const [template] = await db.insert(judgeTemplates).values({
      domain,
      name,
      description,
      criteria,
      passThreshold: passThreshold || 70,
      isOfficial: false,
    }).returning();

    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
