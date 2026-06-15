#!/usr/bin/env node
// Node20 GitHub Action entrypoint — thin GitHub-IO wiring around runAction.
// In CI this is bundled together with the compiled SDK + run-action core (a CI
// freshness check rebuilds dist/ so it never goes stale). It is dependency-free:
// inputs come from INPUT_* env vars, outputs/summary via GitHub's env files.
//
// For local/dev use it expects a bundled `./dist/action.mjs` exporting
// { EvalDesk, runAction }. Kept out of the unit test (the logic lives in
// src/action/run-action.ts, which IS tested); this file is pure plumbing.

import { appendFileSync } from "node:fs";

function input(name) {
  return process.env[`INPUT_${name.toUpperCase()}`] ?? "";
}
function setOutput(key, value) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `${key}=${value}\n`);
}
function appendSummary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) appendFileSync(f, md + "\n");
}

async function main() {
  const { EvalDesk, runAction } = await import("./dist/action.mjs");
  const client = new EvalDesk({ baseUrl: input("base_url"), token: input("token"), org: input("org") });
  const inputs = {
    projectId: input("project_id"),
    minPassRate: input("min_pass_rate") ? Number(input("min_pass_rate")) : undefined,
    maxFailures: input("max_failures") ? Number(input("max_failures")) : undefined,
  };
  const io = {
    log: (m) => console.log(m),
    summary: appendSummary,
    output: setOutput,
  };
  const result = await runAction(client, inputs, io);
  process.exit(result.exitCode);
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
