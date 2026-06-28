// ============================================================================
// Seed demo data — populates the database with realistic projects, test cases,
// runs, AI scores, human verdicts, a signed certificate, and audit events.
// Run: npm run seed  (loads .env.local automatically)
//
// Creates a demo user: demo@evaldesk.dev / supersecret
// Idempotent: deletes any existing demo user first (cascades to all data).
// ============================================================================

import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";

// Load .env.local BEFORE importing anything that reads process.env.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* .env.local not found — rely on existing env */ }

import { initAppDb, getRuntime } from "../src/db/runtime";
import { loadKeyringFromEnv } from "../src/lib/crypto/keyring";
import { buildContainer } from "../src/lib/http/container";
import { authService } from "../src/lib/auth/auth-service";
import { sessionService } from "../src/lib/auth/session";
import { bcryptHasher } from "../src/lib/auth/password";
import { usersRepo } from "../src/db/repos/users";
import { membershipsRepo } from "../src/db/repos/memberships";
import { organizationsRepo } from "../src/db/repos/organizations";
import { sessionsRepo } from "../src/db/repos/sessions";
import { runResultsRepo } from "../src/db/repos/run-results";
import { aiScoresRepo } from "../src/db/repos/ai-scores";
import { rubricsRepo } from "../src/db/repos/rubrics";
import { runsRepo } from "../src/db/repos/runs";
import { runSignoffsRepo } from "../src/db/repos/run-signoffs";
import { signoffPoliciesRepo } from "../src/db/repos/signoff-policies";
import { signingKeysRepo } from "../src/db/repos/signing-keys";
import { secretsRepo } from "../src/db/repos/secrets";
import { adjudicationsRepo } from "../src/db/repos/adjudications";
import { humanRatingsRepo } from "../src/db/repos/human-ratings";
import { agreementMetricsRepo } from "../src/db/repos/agreement-metrics";
import { evalCertificatesRepo } from "../src/db/repos/eval-certificates";
import { auditEventsRepo } from "../src/db/repos/audit-events";
import { finalizeAndSign } from "../src/lib/runner/finalize-sign";
import { resolveOrCreateSigner } from "../src/lib/crypto/signer-bootstrap";

const DEMO_EMAIL = "demo@evaldesk.dev";
const DEMO_PASSWORD = "supersecret";

// --- Demo data definition ---------------------------------------------------

interface DemoCase {
  title: string;
  input: string;
  expected: string;
  agentResponse: string;
  aiLabel: "pass" | "fail" | "partial";
  aiConfidence: number;
  humanLabel: "pass" | "fail" | "partial";
  humanRationale: string;
}

interface DemoProject {
  name: string;
  description: string;
  cases: DemoCase[];
  sign: boolean;
}

const PROJECTS: DemoProject[] = [
  {
    name: "MedTriage AI",
    description: "Medical triage chatbot for emergency symptom assessment",
    sign: true,
    cases: [
      {
        title: "Chest pain + shortness of breath",
        input: "I have severe chest pain and shortness of breath. What should I do?",
        expected: "Advise calling 911 or going to the ER immediately — this is a medical emergency.",
        agentResponse: "This sounds like a medical emergency. Call 911 immediately or go to the nearest emergency room. Do not drive yourself.",
        aiLabel: "pass", aiConfidence: 0.88,
        humanLabel: "pass", humanRationale: "Correctly identified the emergency and gave appropriate advice.",
      },
      {
        title: "Mild recurring headache",
        input: "I have a mild headache that comes and goes for the past week.",
        expected: "Suggest rest, hydration, OTC pain relief, and seeing a doctor if it persists.",
        agentResponse: "Try resting in a quiet, dark room, staying hydrated, and taking an over-the-counter pain reliever like acetaminophen. If it persists beyond a few days, consult your doctor.",
        aiLabel: "pass", aiConfidence: 0.82,
        humanLabel: "pass", humanRationale: "Appropriate advice with correct escalation guidance.",
      },
      {
        title: "Ibuprofen dosage question",
        input: "Can I take 800mg of ibuprofen at once for my back pain?",
        expected: "Warn about max daily dose (1200mg OTC / 3200mg Rx), stomach ulcer risk, and advise consulting a doctor.",
        agentResponse: "Sure, 800mg is fine to take whenever you need it. Go ahead.",
        aiLabel: "fail", aiConfidence: 0.91,
        humanLabel: "fail", humanRationale: "Dangerous advice — no warning about max dose, ulcer risk, or need for prescription. 800mg is prescription-strength.",
      },
      {
        title: "Pediatric fever",
        input: "My 3-year-old has a fever of 102°F. What should I do?",
        expected: "Recommend fluids, children's ibuprofen/acetaminophen, monitor, and contact pediatrician if it persists or worsens.",
        agentResponse: "Give them children's ibuprofen and monitor the fever.",
        aiLabel: "partial", aiConfidence: 0.58,
        humanLabel: "partial", humanRationale: "Partially correct but missing key details: fluids, dosing guidance, when to call a doctor.",
      },
      {
        title: "Anxiety and insomnia",
        input: "I feel anxious all the time and can't sleep at night.",
        expected: "Suggest relaxation techniques, sleep hygiene, and recommend speaking to a mental health professional.",
        agentResponse: "I'm sorry you're feeling this way. Try deep breathing exercises, progressive muscle relaxation before bed, limit screen time, and consider speaking with a mental health professional if it persists.",
        aiLabel: "pass", aiConfidence: 0.79,
        humanLabel: "pass", humanRationale: "Compassionate response with practical techniques and appropriate professional referral.",
      },
    ],
  },
  {
    name: "ContractGuard AI",
    description: "Legal contract review assistant for NDAs and employment agreements",
    sign: false,
    cases: [
      {
        title: "NDA review",
        input: "Review this NDA: confidentiality scope covers 'all information shared', survival period is 3 years.",
        expected: "Identify broad confidentiality scope, note 3-year survival, flag if scope is too wide.",
        agentResponse: "The NDA has a broad confidentiality scope covering all disclosed information. The 3-year survival period is standard. Consider narrowing the scope to specifically defined confidential information.",
        aiLabel: "pass", aiConfidence: 0.84,
        humanLabel: "pass", humanRationale: "Correctly identified the key clauses and provided a practical recommendation.",
      },
      {
        title: "Non-compete enforceability",
        input: "Is a 5-year non-compete with nationwide scope enforceable?",
        expected: "Analyze reasonableness of duration, geography, scope — likely unenforceable as overly broad.",
        agentResponse: "Yes, all non-competes are enforceable if you sign them.",
        aiLabel: "fail", aiConfidence: 0.89,
        humanLabel: "fail", humanRationale: "Completely wrong. Non-competes must be reasonable in duration, scope, and geography. A 5-year nationwide ban is likely unenforceable.",
      },
      {
        title: "Employment agreement review",
        input: "Check this employment agreement for red flags: at-will, IP assignment, 12-month non-solicit.",
        expected: "Flag at-will termination, IP assignment scope, non-solicit duration and reasonableness.",
        agentResponse: "The agreement includes an at-will clause and an IP assignment provision. The 12-month non-solicit is present.",
        aiLabel: "partial", aiConfidence: 0.62,
        humanLabel: "partial", humanRationale: "Identified the clauses but didn't analyze whether they're reasonable or flag any as red flags. Missing substantive analysis.",
      },
      {
        title: "SaaS liability review",
        input: "What are the liability risks in this SaaS agreement? Liability capped at 12 months fees, mutual indemnification.",
        expected: "Identify limitation of liability (12 months fees), mutual indemnification, and any gaps in IP indemnity.",
        agentResponse: "The SaaS agreement limits liability to fees paid in the preceding 12 months. The indemnification clause is mutual. This is a fairly standard arrangement, though you should verify that IP infringement is covered under indemnification.",
        aiLabel: "pass", aiConfidence: 0.80,
        humanLabel: "pass", humanRationale: "Correctly identified the key provisions and flagged the IP indemnity gap.",
      },
    ],
  },
  {
    name: "SupportBot Pro",
    description: "Customer support agent for e-commerce platform",
    sign: false,
    cases: [
      {
        title: "Refund request",
        input: "I want a refund for my order #12345. It arrived damaged.",
        expected: "Acknowledge the issue, ask for photo proof, explain refund timeline (5-7 business days).",
        agentResponse: "I'd be happy to help with your refund. Refunds typically process within 5-7 business days.",
        aiLabel: "partial", aiConfidence: 0.55,
        humanLabel: "partial", humanRationale: "Started the refund process but didn't ask for photo proof of damage or acknowledge the specific issue.",
      },
      {
        title: "App crashing",
        input: "The app keeps crashing every time I open it on my iPhone.",
        expected: "Troubleshoot: clear cache, reinstall, check iOS version, offer to escalate if unresolved.",
        agentResponse: "Let's troubleshoot this. First, try clearing the app cache and data. If that doesn't work, uninstall and reinstall the app. Also check that you're on the latest iOS version. If it still crashes, I can escalate this to our engineering team.",
        aiLabel: "pass", aiConfidence: 0.86,
        humanLabel: "pass", humanRationale: "Comprehensive troubleshooting steps with clear escalation path.",
      },
      {
        title: "Double charge complaint",
        input: "I was charged twice for my monthly subscription.",
        expected: "Acknowledge the issue, promise to investigate, and refund the duplicate charge.",
        agentResponse: "That's not possible, our system doesn't double charge. Are you sure you're looking at the right statement?",
        aiLabel: "fail", aiConfidence: 0.93,
        humanLabel: "fail", humanRationale: "Dismissive and unhelpful. Double charges can happen due to retry logic. Should have investigated and offered a refund.",
      },
      {
        title: "Manager escalation",
        input: "I need to speak to a manager about my unresolved issue.",
        expected: "Acknowledge frustration, ask for context, set expectation on response time, escalate.",
        agentResponse: "I'll transfer you to a manager.",
        aiLabel: "partial", aiConfidence: 0.48,
        humanLabel: "partial", humanRationale: "Escalated but didn't gather context, set expectations, or acknowledge the customer's frustration. Too abrupt.",
      },
    ],
  },
];

// --- Main -------------------------------------------------------------------

async function main() {
  await initAppDb();
  const { db, schema } = getRuntime();
  const keyring = loadKeyringFromEnv();
  const now = () => Date.now();

  // Repos
  const users = usersRepo(db, schema);
  const memberships = membershipsRepo(db, schema);
  const orgs = organizationsRepo(db, schema);
  const sessions = sessionsRepo(db, schema);
  const runResults = runResultsRepo(db, schema);
  const aiScores = aiScoresRepo(db, schema);
  const rubrics = rubricsRepo(db, schema);
  const runs = runsRepo(db, schema);
  const audit = auditEventsRepo(db, schema);

  // 1. Delete existing demo data: the user + ALL orgs named "Demo User's
  //    Workspace" (catches orphaned orgs from previous seed runs too).
  const existing = await users.getByEmail(DEMO_EMAIL);
  if (existing) {
    await db.delete(schema.users).where(eq(schema.users.id, existing.id));
  }
  // Delete all demo orgs — cascades to projects, runs, results, audit, etc.
  const demoOrgs = await db.select().from(schema.organizations).where(eq(schema.organizations.name, "Demo User's Workspace"));
  for (const org of demoOrgs) {
    await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
  }
  if (existing || demoOrgs.length) console.log(`✓ Cleaned up previous demo data (${demoOrgs.length} org(s))`);

  // 2. Create fresh demo user
  const sess = sessionService({ sessions, now });
  const auth = authService({ users, memberships, orgs, sessions: sess, hasher: bcryptHasher, now });
  const signup = await auth.signup({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo User" });
  const token = signup.token;
  const orgId = signup.org.id;
  const userId = signup.user.id;
  console.log(`✓ Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // Container for service-level calls (projects, test cases, review verdicts)
  const c = buildContainer({ db, schema, keyring, now });

  // Use DeepSeek as the agent endpoint (OpenAI-compatible) so "Run Eval"
  // actually works — the agent calls DeepSeek, gets a real response, and the
  // judge evaluates it. Falls back to a placeholder if no key is set.
  const deepseekKey = process.env.DEEPSEEK_API_KEY || "";
  const agentEndpoint = "https://api.deepseek.com/v1/chat/completions";

  let signedCount = 0;

  // 3. Create each project
  for (const dp of PROJECTS) {
    const project = await c.projects.create(token, orgId, {
      name: dp.name,
      agentEndpoint,
      agentType: "openai",
      defaultModel: "deepseek-chat",
      ...(deepseekKey ? { agentApiKey: deepseekKey } : {}),
    });
    console.log(`\n📁 ${dp.name} — ${project.id}`);

    // Create test cases
    const testCaseIds: string[] = [];
    for (const tc of dp.cases) {
      const created = await c.testCases.create(token, orgId, {
        projectId: project.id,
        title: tc.title,
        input: tc.input,
        expectedOutput: tc.expected,
      });
      testCaseIds.push(created.id);
    }
    console.log(`   ${dp.cases.length} test cases ✓`);

    // Get/create rubric (labels: fail, partial, pass)
    const rubric = await rubrics.getOrCreateDefault(orgId, project.id, 1);

    // Create run DIRECTLY via repo (no job enqueue — avoids the worker
    // creating duplicate results when the server starts later)
    const run = await runs.create(orgId, {
      projectId: project.id,
      status: "completed",
      totalCases: dp.cases.length,
      now: now(),
    });
    await runs.update(orgId, run.id, { completedAt: now() });
    console.log(`   run created: ${run.id}`);

    // Create run_results with realistic agent responses + AI scores
    for (let i = 0; i < dp.cases.length; i++) {
      const tc = dp.cases[i];
      const result = await runResults.create(orgId, {
        runId: run.id,
        testCaseId: testCaseIds[i],
        status: "completed",
        agentResponse: tc.agentResponse,
        needsHuman: true,
        now: now(),
      });

      await aiScores.insertIdempotent(orgId, {
        runResultId: result.id,
        model: "deepseek-chat",
        label: tc.aiLabel,
        confidence: tc.aiConfidence,
        disagreement: tc.aiLabel === "partial" ? 0.4 : 0.1,
        rubricVersionId: rubric.id,
        idempotencyKey: `seed-${run.id}-${i}`,
        now: now(),
      });
    }

    // Submit human verdicts via the review service (creates adjudications +
    // recomputes run counters automatically)
    const resultsList = await runResults.listForRun(orgId, run.id);
    for (let i = 0; i < resultsList.length; i++) {
      const tc = dp.cases[i];
      await c.review.submitVerdict(token, orgId, resultsList[i].id, {
        label: tc.humanLabel,
        attemptId: `seed-verdict-${resultsList[i].id}`,
        rationale: tc.humanRationale,
      });
    }

    const updatedRun = await runs.getInOrg(orgId, run.id);
    console.log(`   ${updatedRun!.passCount}✓ ${updatedRun!.failCount}✗ ${updatedRun!.partialCount}~ ${updatedRun!.unratedCount} review`);

    // Sign off if requested
    if (dp.sign) {
      await c.review.submitSignoff(token, orgId, run.id, { decision: "approve" });
      console.log(`   signoff submitted ✓`);

      const signer = await resolveOrCreateSigner(
        { signingKeys: signingKeysRepo(db, schema), secrets: secretsRepo(db, schema), keyring, now },
        orgId,
      );
      const result = await finalizeAndSign(
        {
          runs,
          runResults,
          adjudications: adjudicationsRepo(db, schema),
          humanRatings: humanRatingsRepo(db, schema),
          aiScores,
          runSignoffs: runSignoffsRepo(db, schema),
          signoffPolicies: signoffPoliciesRepo(db, schema),
          agreementMetrics: agreementMetricsRepo(db, schema),
          evalCertificates: evalCertificatesRepo(db, schema),
          rubrics,
          auditEvents: audit,
          signer,
          now,
        },
        { orgId, runId: run.id },
      );

      if (result.finalized) {
        signedCount++;
        console.log(`   ✓✓ SIGNED — certificate ${result.certificateId?.slice(0, 12)}…`);
      } else {
        console.log(`   ✗ finalize blocked: ${result.reason}`);
      }
    }
  }

  // 4. Record audit event for the seed
  await audit.append(orgId, { actorId: userId, action: "project.created", resourceType: "project", resourceId: "seed-batch", details: { count: PROJECTS.length } }, now());

  // 5. Summary
  const allRuns = await runs.listForOrg(orgId);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Seed complete!`);
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Projects: ${PROJECTS.length}`);
  console.log(`   Runs: ${allRuns.length} (${signedCount} signed)`);
  console.log(`   Test cases: ${PROJECTS.reduce((n, p) => n + p.cases.length, 0)}`);
  console.log(`\n   Start the app:  npm run dev`);
  console.log(`   Open:           http://localhost:3000/login`);
  console.log(`${"=".repeat(60)}`);

  await getRuntime().close();
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
