import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates, projects, runs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const certId = req.nextUrl.searchParams.get("id");

  // Public access — if certId and isPublic
  if (certId) {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, certId));
    if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!cert.isPublic) {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Private certificate" }, { status: 403 });
    }
    const [project] = await db.select().from(projects).where(eq(projects.id, cert.projectId));
    return NextResponse.json({ ...cert, projectName: project?.name });
  }

  // Auth required for listing
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  if (projectId) {
    const certs = await db.select().from(certificates).where(eq(certificates.projectId, projectId)).orderBy(desc(certificates.createdAt));
    return NextResponse.json(certs);
  }

  return NextResponse.json({ error: "projectId or id required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { projectId, runId, name, description, isPublic, badgeColor, expiresAt } = body;

    if (!projectId || !name) {
      return NextResponse.json({ error: "projectId and name required" }, { status: 400 });
    }

    // Get latest run stats if runId provided
    let passRate = null, totalCases = null, passCount = null, failCount = null;
    if (runId) {
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));
      if (run) {
        passRate = run.passRate;
        totalCases = run.totalCases;
        passCount = run.passCount;
        failCount = run.failCount;
      }
    } else {
      // Use latest completed run
      const [latestRun] = await db.select().from(runs)
        .where(eq(runs.projectId, projectId))
        .orderBy(desc(runs.createdAt)).limit(1);
      if (latestRun) {
        passRate = latestRun.passRate;
        totalCases = latestRun.totalCases;
        passCount = latestRun.passCount;
        failCount = latestRun.failCount;
      }
    }

    const [cert] = await db.insert(certificates).values({
      projectId,
      runId: runId || null,
      name,
      description: description || null,
      passRate,
      totalCases,
      passCount,
      failCount,
      isPublic: isPublic !== false,
      badgeColor: badgeColor || "#ABC83A",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    return NextResponse.json(cert);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(certificates).where(eq(certificates.id, id));
  return NextResponse.json({ success: true });
}
