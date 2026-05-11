/**
 * Scheduler — manages cron-based evaluation runs.
 *
 * Uses a simple interval-based approach. For production, replace with
 * a proper cron library (node-cron, bullmq, etc.) or an external scheduler.
 */

import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the scheduler — checks for due scheduled runs every minute.
 */
export function startScheduler(checkIntervalMs = 60_000) {
  if (intervalHandle) return; // already running

  intervalHandle = setInterval(async () => {
    try {
      await executeDueSchedules();
    } catch {
      // Silently retry next interval
    }
  }, checkIntervalMs);

  // Don't let the interval prevent process exit
  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}

/**
 * Stop the scheduler.
 */
export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Check and execute all due scheduled runs by calling the execute endpoint.
 */
async function executeDueSchedules() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/schedules/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.error("[scheduler] Execute endpoint returned", res.status);
    }
  } catch {
    // Server may not be reachable during build
  }
}

/**
 * Compute the next run date from a cron expression.
 * Simple implementation supporting common patterns.
 */
export function getNextRunDate(cronExpression: string, from = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);

  // Handle common presets
  if (cronExpression === "@hourly") {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }
  if (cronExpression === "@daily") {
    const next = new Date(from);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
  if (cronExpression === "@weekly") {
    const next = new Date(from);
    next.setDate(next.getDate() + 7);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Standard 5-field cron: minute hour day-of-month month day-of-week
  if (parts.length !== 5) {
    // Default: 24 hours from now
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }

  const [minute, hour, , , ] = parts;
  const next = new Date(from);

  if (minute !== "*") {
    next.setMinutes(parseInt(minute, 10), 0, 0);
  }
  if (hour !== "*") {
    next.setHours(parseInt(hour, 10), 0, 0, 0);
  }

  // If the computed time is in the past, advance by one day
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}
