// Suite pack registry. Maps a suite id to its manifest. The MIT core ships the
// HIPAA pack as the flagship; additional packs (EU-AI-Act, RBI) register the
// same way. Commercial packs (@evaldesk/suite-*) load at runtime via the
// commercial registry — never imported into src/ (open-core boundary).
import { HIPAA_MANIFEST } from "./hipaa";
import { EU_AI_ACT_MANIFEST } from "./eu-ai-act";
import type { SuiteManifest } from "../manifest";

const PACKS: Record<string, SuiteManifest> = {
  hipaa: HIPAA_MANIFEST,
  "eu-ai-act": EU_AI_ACT_MANIFEST,
};

export function getSuitePack(id: string): SuiteManifest | undefined {
  return PACKS[id];
}

export function listSuitePacks(): SuiteManifest[] {
  return Object.values(PACKS);
}
