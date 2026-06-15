// Dependency container — builds the wired services from a DbHandle + keyring.
// The route composition root calls buildContainer(getAppDb(), ...); tests call
// it with a test DB. This is the one place repos/services are assembled.
import type { DbHandle, AppSchema } from "@/db/client";
import type { Keyring } from "@/lib/crypto/secrets";
import { usersRepo } from "@/db/repos/users";
import { membershipsRepo } from "@/db/repos/memberships";
import { sessionsRepo } from "@/db/repos/sessions";
import { projectsRepo } from "@/db/repos/projects";
import { secretsRepo } from "@/db/repos/secrets";
import { testCasesRepo } from "@/db/repos/test-cases";
import { runsRepo } from "@/db/repos/runs";
import { runResultsRepo } from "@/db/repos/run-results";
import { aiScoresRepo } from "@/db/repos/ai-scores";
import { humanRatingsRepo } from "@/db/repos/human-ratings";
import { adjudicationsRepo } from "@/db/repos/adjudications";
import { runSignoffsRepo } from "@/db/repos/run-signoffs";
import { rubricsRepo } from "@/db/repos/rubrics";
import { evalCertificatesRepo } from "@/db/repos/eval-certificates";
import { judgeCalibrationRepo } from "@/db/repos/judge-calibration";
import { agreementMetricsRepo } from "@/db/repos/agreement-metrics";
import { webhooksRepo } from "@/db/repos/webhooks";
import { apiKeysRepo } from "@/db/repos/api-keys";
import { rateLimitsRepo } from "@/db/repos/rate-limits";
import { jobsRepo } from "@/db/repos/jobs";
import { sessionService } from "@/lib/auth/session";
import { authService } from "@/lib/auth/auth-service";
import { bcryptHasher } from "@/lib/auth/password";
import { guard } from "@/lib/auth/guard";
import { organizationsRepo } from "@/db/repos/organizations";
import { projectsService } from "@/lib/services/projects-service";
import { testCasesService } from "@/lib/services/test-cases-service";
import { runsService } from "@/lib/services/runs-service";
import { reviewService } from "@/lib/services/review-service";
import { identityService } from "@/lib/services/identity-service";
import { webhooksService } from "@/lib/services/webhooks-service";
import { importService } from "@/lib/services/import-service";
import { apiKeysService } from "@/lib/services/api-keys-service";
import { rateLimiter } from "@/lib/services/rate-limiter";
import { membersService } from "@/lib/services/members-service";
import { passwordResetService } from "@/lib/services/password-reset-service";
import { passwordResetTokensRepo } from "@/db/repos/password-reset-tokens";

export interface Container {
  projects: ReturnType<typeof projectsService>;
  testCases: ReturnType<typeof testCasesService>;
  runs: ReturnType<typeof runsService>;
  review: ReturnType<typeof reviewService>;
  identity: ReturnType<typeof identityService>;
  webhooks: ReturnType<typeof webhooksService>;
  imports: ReturnType<typeof importService>;
  auth: ReturnType<typeof authService>;
  apiKeys: ReturnType<typeof apiKeysService>;
  rateLimiter: ReturnType<typeof rateLimiter>;
  members: ReturnType<typeof membersService>;
  passwordReset: ReturnType<typeof passwordResetService>;
}

export interface ContainerDeps {
  db: DbHandle;
  schema: AppSchema;
  keyring: Keyring;
  now?: () => number;
}

export function buildContainer(deps: ContainerDeps): Container {
  const now = deps.now ?? (() => Date.now());
  const sessions = sessionService({ sessions: sessionsRepo(deps.db, deps.schema), now });
  const g = guard({
    sessions,
    memberships: membershipsRepo(deps.db, deps.schema),
    users: usersRepo(deps.db, deps.schema),
    apiKeys: apiKeysRepo(deps.db, deps.schema),
    now,
  });
  const projectsRepoInst = projectsRepo(deps.db, deps.schema);
  const projects = projectsService({
    guard: g,
    projects: projectsRepoInst,
    secrets: secretsRepo(deps.db, deps.schema),
    keyring: deps.keyring,
    now,
  });
  const testCases = testCasesService({
    guard: g,
    projects: projectsRepoInst,
    testCases: testCasesRepo(deps.db, deps.schema),
    now,
  });
  const runsRepoInst = runsRepo(deps.db, deps.schema);
  const jobsRepoInst = jobsRepo(deps.db, deps.schema);
  const runs = runsService({
    guard: g,
    projects: projectsRepoInst,
    runs: runsRepoInst,
    jobs: jobsRepoInst,
    now,
  });
  const review = reviewService({
    guard: g,
    runs: runsRepoInst,
    runResults: runResultsRepo(deps.db, deps.schema),
    testCases: testCasesRepo(deps.db, deps.schema),
    aiScores: aiScoresRepo(deps.db, deps.schema),
    humanRatings: humanRatingsRepo(deps.db, deps.schema),
    adjudications: adjudicationsRepo(deps.db, deps.schema),
    runSignoffs: runSignoffsRepo(deps.db, deps.schema),
    rubrics: rubricsRepo(deps.db, deps.schema),
    evalCertificates: evalCertificatesRepo(deps.db, deps.schema),
    judgeCalibration: judgeCalibrationRepo(deps.db, deps.schema),
    agreementMetrics: agreementMetricsRepo(deps.db, deps.schema),
    jobs: jobsRepoInst,
    now,
  });
  const identity = identityService({
    sessions,
    memberships: membershipsRepo(deps.db, deps.schema),
    orgs: organizationsRepo(deps.db, deps.schema),
    users: usersRepo(deps.db, deps.schema),
  });
  const auth = authService({
    users: usersRepo(deps.db, deps.schema),
    memberships: membershipsRepo(deps.db, deps.schema),
    orgs: organizationsRepo(deps.db, deps.schema),
    sessions,
    hasher: bcryptHasher,
    now,
  });
  const webhooks = webhooksService({
    guard: g,
    webhooks: webhooksRepo(deps.db, deps.schema),
    keyring: deps.keyring,
    now,
  });
  const imports = importService({
    guard: g,
    projects: projectsRepoInst,
    testCases: testCasesRepo(deps.db, deps.schema),
    now,
  });
  const apiKeys = apiKeysService({
    guard: g,
    apiKeys: apiKeysRepo(deps.db, deps.schema),
    now,
  });
  const limiter = rateLimiter({ rateLimits: rateLimitsRepo(deps.db, deps.schema), now });
  const members = membersService({
    guard: g,
    memberships: membershipsRepo(deps.db, deps.schema),
    users: usersRepo(deps.db, deps.schema),
    now,
  });
  const passwordReset = passwordResetService({
    users: usersRepo(deps.db, deps.schema),
    resetTokens: passwordResetTokensRepo(deps.db, deps.schema),
    sessions: sessionsRepo(deps.db, deps.schema),
    hasher: bcryptHasher,
    now,
  });
  return { projects, testCases, runs, review, identity, webhooks, imports, auth, apiKeys, rateLimiter: limiter, members, passwordReset };
}
