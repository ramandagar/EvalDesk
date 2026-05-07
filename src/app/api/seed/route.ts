import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, projects, testCases, runs, runResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    let userId: string;
    const authUser = await (await import("@/lib/api-utils")).requireAuth(req);

    if (authUser) {
      userId = authUser.id;
    } else {
      const existing = await db.select().from(users).limit(1);
      if (existing.length > 0) {
        userId = existing[0].id;
      } else {
        userId = createId();
        await db.insert(users).values({ id: userId, name: "Demo User", email: "demo@evaldesk.dev", emailVerified: new Date() });
      }
    }

    // Reset: delete all existing data if ?reset=true
    const reset = req.nextUrl.searchParams.get("reset") === "true";

    const existingProjects = await db.select().from(projects).where(eq(projects.userId, userId));
    if (existingProjects.length > 0 && !reset) {
      return NextResponse.json({ message: "Already seeded", projectCount: existingProjects.length });
    }

    // Delete all data for this user (for reset or re-seed)
    for (const p of existingProjects) {
      const projectRuns = await db.select({ id: runs.id }).from(runs).where(eq(runs.projectId, p.id));
      for (const r of projectRuns) {
        await db.delete(runResults).where(eq(runResults.runId, r.id));
      }
      await db.delete(runs).where(eq(runs.projectId, p.id));
      await db.delete(testCases).where(eq(testCases.projectId, p.id));
    }
    await db.delete(projects).where(eq(projects.userId, userId));

    // ============ PROJECT 1: Medical Triage ============
    const medId = createId();
    await db.insert(projects).values({ id: medId, name: "Medical Triage Bot", description: "Evaluating triage accuracy for ER patient intake", agentEndpoint: "https://api.openai.com/v1/chat/completions", userId, agentHeaders: JSON.stringify({ type: "openai" }) });

    const medCases = [
      { input: "I have chest pain and shortness of breath. It started 30 minutes ago.", expectedOutput: "Recognize cardiac emergency, recommend calling 112, advise against driving.", category: "Cardiology" },
      { input: "My 3-year-old has had a fever of 39.5\u00b0C for 3 days and won't eat.", expectedOutput: "Recommend urgent pediatric evaluation, mention dehydration risk.", category: "Pediatrics" },
      { input: "I accidentally took double my blood pressure medication.", expectedOutput: "Advise contacting poison control or emergency services.", category: "Pharmacology" },
      { input: "I've had a persistent headache for 2 weeks and blurry vision.", expectedOutput: "Recommend seeing a doctor soon, mention possible causes, advise against ignoring.", category: "Neurology" },
      { input: "My child fell and hit their head. They're vomiting and confused.", expectedOutput: "This is a head injury emergency. Recommend going to ER immediately.", category: "Pediatrics" },
    ];
    const medCaseIds: string[] = [];
    for (const c of medCases) { const id = createId(); medCaseIds.push(id); await db.insert(testCases).values({ id, projectId: medId, title: c.input.slice(0, 80), input: c.input, expectedOutput: c.expectedOutput, category: c.category }); }

    // Create 5 runs with trending pass rates for chart data
    const medRunConfigs = [
      { name: "Baseline v0.1", passRate: 40, passCount: 2, failCount: 3, partialCount: 0, daysAgo: 30 },
      { name: "Prompt v0.2", passRate: 60, passCount: 3, failCount: 2, partialCount: 0, daysAgo: 24 },
      { name: "RAG enabled", passRate: 60, passCount: 3, failCount: 1, partialCount: 1, daysAgo: 18 },
      { name: "Fine-tuned v1", passRate: 80, passCount: 4, failCount: 1, partialCount: 0, daysAgo: 10 },
      { name: "Production v1.1", passRate: 80, passCount: 4, failCount: 0, partialCount: 1, daysAgo: 1 },
    ];

    const responses = [
      ["Cardiac emergency detected. Call 112 immediately.", "Fever of 39.5\u00b0C for 3 days needs evaluation. See pediatrician today.", "Taking double medication is fine, just skip next dose.", "Headaches are common. Take some rest and painkillers.", "Apply ice to the bump and monitor."],
      ["Call 112 for chest pain. Do not drive yourself.", "High fever for 3 days in a child needs urgent care.", "Contact poison control immediately at their hotline.", "Persistent headaches need medical evaluation. Book an appointment.", "Apply ice and monitor the child."],
      ["Cardiac emergency - call 112 now. Chew an aspirin if available.", "Urgent pediatric care needed. Watch for dehydration signs.", "Contact poison control immediately.", "Two weeks of headache with blurry vision needs a doctor visit soon.", "Head injury with vomiting is an emergency. Go to ER now."],
      ["Cardiac emergency detected. Call 112 immediately. Do not drive.", "Fever 39.5\u00b0C for 3 days in a child requires urgent evaluation. Watch for dehydration.", "Double dosing blood pressure medication - contact poison control or go to ER.", "Persistent headache with blurry vision needs prompt medical evaluation. Could indicate increased intracranial pressure.", "Head injury with vomiting and confusion is an emergency. Go to ER immediately. Do not give food or water."],
      ["Cardiac emergency. Call 112. Aspirin if available. Sit upright.", "3 days of high fever in a toddler is urgent. Watch dehydration signs. See pediatrician today.", "Contact poison control immediately. Don't skip next dose - call your doctor.", "2 weeks of headache + blurry vision needs urgent evaluation. Could be neurological.", "Head injury + vomiting = ER immediately. Keep child still and awake."],
    ];
    const ratings = [
      ["pass", "pass", "fail", "fail", "fail"],
      ["pass", "pass", "pass", "fail", "fail"],
      ["pass", "pass", "pass", "partial", "fail"],
      ["pass", "pass", "pass", "pass", "fail"],
      ["pass", "pass", "pass", "pass", "partial"],
    ];

    for (let ri = 0; ri < medRunConfigs.length; ri++) {
      const cfg = medRunConfigs[ri];
      const runId = createId();
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - cfg.daysAgo);
      await db.insert(runs).values({
        id: runId, projectId: medId, name: cfg.name, status: "completed",
        totalCases: medCases.length, passCount: cfg.passCount, failCount: cfg.failCount,
        partialCount: cfg.partialCount, unratedCount: 0, passRate: cfg.passRate,
        completedAt: createdAt, triggeredBy: userId, createdAt,
      });
      for (let i = 0; i < medCaseIds.length; i++) {
        await db.insert(runResults).values({
          id: createId(), runId, testCaseId: medCaseIds[i],
          agentResponse: responses[ri][i], responseTime: 800 + Math.floor(Math.random() * 500),
          status: "completed", humanRating: ratings[ri][i], ratedBy: userId, ratedAt: createdAt,
        });
      }
    }

    // ============ PROJECT 2: Legal Contract Review ============
    const legId = createId();
    await db.insert(projects).values({ id: legId, name: "Legal Contract Analyzer", description: "Review contract clauses for compliance and risk", agentEndpoint: "https://openrouter.ai/api/v1/chat/completions", userId, agentHeaders: JSON.stringify({ type: "openrouter" }) });

    const legCases = [
      { input: "Review this clause: 'The Company may terminate this agreement at any time without notice.'", expectedOutput: "Flag as one-sided termination clause, recommend adding notice period.", category: "Termination" },
      { input: "Does this NDA cover both parties equally?", expectedOutput: "Check if mutual NDA or one-sided, flag if obligations are asymmetric.", category: "NDA" },
      { input: "What are the liability caps in this SaaS agreement?", expectedOutput: "Identify limitation of liability clause, check if caps are reasonable.", category: "Liability" },
    ];
    const legCaseIds: string[] = [];
    for (const c of legCases) { const id = createId(); legCaseIds.push(id); await db.insert(testCases).values({ id, projectId: legId, title: c.input.slice(0, 80), input: c.input, expectedOutput: c.expectedOutput, category: c.category }); }

    const legRunId = createId();
    await db.insert(runs).values({ id: legRunId, projectId: legId, name: "Contract review v1", status: "completed", totalCases: 3, passCount: 2, failCount: 0, partialCount: 1, unratedCount: 0, passRate: 67, completedAt: new Date(), triggeredBy: userId });
    const legResponses = ["This is a unilateral termination clause. Recommend requiring 30-day written notice.", "This appears to be a mutual NDA with symmetric obligations for both parties.", "Liability is capped at 12 months of fees, which is within industry standard range."];
    const legRatings = ["pass", "pass", "partial"] as const;
    for (let i = 0; i < legCaseIds.length; i++) { await db.insert(runResults).values({ id: createId(), runId: legRunId, testCaseId: legCaseIds[i], agentResponse: legResponses[i], responseTime: [2100, 1800, 1500][i], status: "completed", humanRating: legRatings[i], humanComment: i === 2 ? "Correct but missed indemnification clause" : null, ratedBy: userId, ratedAt: new Date() }); }

    // ============ PROJECT 3: Customer Support Bot ============
    const csId = createId();
    await db.insert(projects).values({ id: csId, name: "Support Bot", description: "E-commerce customer support chatbot evaluation", agentEndpoint: "https://api.custom-agent.com/chat", userId, agentHeaders: JSON.stringify({ type: "custom" }) });

    const csCases = [
      { input: "I want to return a product I bought 3 weeks ago. What's your policy?", expectedOutput: "Explain 30-day return policy, provide return steps, offer to help initiate.", category: "Returns" },
      { input: "Where is my order? Order #ORD-88321", expectedOutput: "Look up order status, provide tracking info and estimated delivery.", category: "Order Status" },
      { input: "Do you ship internationally?", expectedOutput: "Confirm international shipping availability, list supported regions.", category: "Shipping" },
      { input: "The product arrived damaged. I want a refund.", expectedOutput: "Apologize, offer immediate replacement or refund, provide photo upload link.", category: "Complaints" },
    ];
    for (const c of csCases) { await db.insert(testCases).values({ id: createId(), projectId: csId, title: c.input.slice(0, 80), input: c.input, expectedOutput: c.expectedOutput, category: c.category }); }

    // ============ PROJECT 4: Education Tutor ============
    const eduId = createId();
    await db.insert(projects).values({ id: eduId, name: "Math Tutor AI", description: "8th grade math tutor accuracy check", agentEndpoint: "https://api.langchain.app/invoke", userId, agentHeaders: JSON.stringify({ type: "langchain" }) });

    const eduCases = [
      { input: "Explain the Pythagorean theorem in simple terms.", expectedOutput: "Simple explanation with visual analogy, mention a\u00b2+b\u00b2=c\u00b2, give example.", category: "Geometry" },
      { input: "How do I solve 3x + 7 = 22?", expectedOutput: "Step-by-step: subtract 7, divide by 3, x = 5. Check: 15+7=22", category: "Algebra" },
      { input: "What is the formula for the area of a circle?", expectedOutput: "A = \u03c0r\u00b2, explain what each part means, give example calculation.", category: "Geometry" },
    ];
    for (const c of eduCases) { await db.insert(testCases).values({ id: createId(), projectId: eduId, title: c.input.slice(0, 80), input: c.input, expectedOutput: c.expectedOutput, category: c.category }); }

    return NextResponse.json({
      success: true,
      user: userId,
      projects: [medId, legId, csId, eduId],
      totalCases: medCases.length + legCases.length + csCases.length + eduCases.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
