/**
 * Regression Gate — Threshold checking for runs.
 * Determines if a run passes its quality gate based on pass rate.
 */

export type GateStatus = "passed" | "failed" | "warning";

export interface GateResult {
  status: GateStatus;
  passRate: number | null;
  threshold: number;
  message: string;
  details: {
    totalCases: number;
    passCount: number;
    failCount: number;
    partialCount: number;
    delta: number | null; // difference between pass rate and threshold
  };
}

/**
 * Check if a run's pass rate passes the regression gate.
 *
 * - "passed": passRate >= threshold
 * - "warning": passRate is within 5 points below threshold
 * - "failed": passRate is more than 5 points below threshold
 */
export function checkGate(params: {
  passRate: number | null;
  threshold: number;
  totalCases: number;
  passCount: number;
  failCount: number;
  partialCount: number;
}): GateResult {
  const { passRate, threshold, totalCases, passCount, failCount, partialCount } = params;

  if (passRate === null) {
    return {
      status: "failed",
      passRate: null,
      threshold,
      message: "Run has no pass rate — cannot evaluate gate",
      details: {
        totalCases,
        passCount,
        failCount,
        partialCount,
        delta: null,
      },
    };
  }

  const delta = passRate - threshold;
  const absDelta = Math.abs(delta);

  let status: GateStatus;
  let message: string;

  if (passRate >= threshold) {
    status = "passed";
    message = absDelta === 0
      ? `Pass rate exactly meets threshold (${passRate}%)`
      : `Pass rate ${passRate}% exceeds threshold by ${absDelta} points`;
  } else if (absDelta <= 5) {
    status = "warning";
    message = `Pass rate ${passRate}% is within 5 points of threshold (${threshold}%)`;
  } else {
    status = "failed";
    message = `Pass rate ${passRate}% is ${absDelta} points below threshold (${threshold}%)`;
  }

  return {
    status,
    passRate,
    threshold,
    message,
    details: {
      totalCases,
      passCount,
      failCount,
      partialCount,
      delta,
    },
  };
}
