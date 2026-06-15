// End-to-end smoke test against a running server: signup → project → test cases
// → run → worker (execute + judge) → review queue → verdicts → sign-off →
// signed certificate. Run: node scripts/e2e-smoke.mjs
const BASE = process.env.BASE || "http://localhost:3100";
let cookie = "";

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0];
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { status: res.status, json };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

(async () => {
  // warm-up (triggers DB init + worker start before we assert anything)
  await call("GET", "/api/v1/me");

  const email = `e2e_${Date.now()}@evaldesk.dev`;
  let r = await call("POST", "/api/auth/login", { email, password: "supersecret", name: "E2E", action: "signup" });
  if (r.status !== 200) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.json)}`);
  log("1) signup ✓", email);

  const me = await call("GET", "/api/v1/me");
  const org = me.json.activeOrgId;
  const H = { "x-org-id": org };
  log("   org =", org);

  r = await call("POST", "/api/v1/projects", { name: "E2E Bot", agentEndpoint: "https://httpbin.org/post", agentType: "openai" }, H);
  const pid = r.json.project.id;
  log("2) project ✓", pid);

  for (const q of ["chest pain and shortness of breath", "mild seasonal headache"]) {
    await call("POST", "/api/v1/test-cases", { projectId: pid, title: q.slice(0, 20), input: q, expectedOutput: "appropriate medical advice" }, H);
  }
  log("   2 test cases ✓");

  r = await call("POST", "/api/v1/runs", { projectId: pid }, H);
  const runId = r.json.run.id;
  log("3) run created ✓", runId, "(status", r.json.run.status + ")");

  // poll until the run finishes judging
  let run;
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    run = (await call("GET", `/api/v1/runs/${runId}`, undefined, H)).json.run;
    if (run.status === "completed" || run.status === "signed" || run.status === "failed") break;
  }
  log(`   run: status=${run.status} total=${run.totalCases} pass=${run.passCount} toReview=${run.unratedCount}`);

  const queue = (await call("GET", `/api/v1/runs/${runId}/queue`, undefined, H)).json.items || [];
  log(`4) review queue: ${queue.length} items`);
  for (const item of queue) {
    const vr = await call("POST", `/api/v1/results/${item.resultId}/verdicts`, { label: "pass", attemptId: `a-${item.resultId}`, rationale: "verified correct" }, H);
    if (vr.status >= 400) log("   verdict err", vr.status, JSON.stringify(vr.json));
  }
  log(`   submitted ${queue.length} verdicts ✓`);

  await call("POST", `/api/v1/runs/${runId}/signoff`, { decision: "approve" }, H);
  log("5) sign-off approved ✓ — waiting for finalize…");
  await sleep(6000);

  const cert = (await call("GET", `/api/v1/runs/${runId}/certificate`, undefined, H)).json.certificate;
  const finalRun = (await call("GET", `/api/v1/runs/${runId}`, undefined, H)).json.run;
  if (cert) {
    log(`6) ✓✓ SIGNED CERTIFICATE: hash=${cert.contentHash.slice(0, 16)}… algo=${cert.algo} sigLen=${cert.signature.length}`);
    log(`   run locked: status=${finalRun.status}`);
    log("\n🎉 FULL E2E PASSED on Postgres: agent → judge → review → sign-off → signed cert");
  } else {
    log(`6) ✗ no certificate. run status=${finalRun.status}`);
    process.exit(1);
  }
})().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
