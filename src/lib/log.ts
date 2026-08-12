// Structured JSON logger for Railway deployment.
// Each line is a JSON object — Railway can filter by "level":"error" in the log viewer.
//
// SECURITY RULE: never pass password, token, otp, pin, secret, or hash in ctx.
// Sensitive keys are automatically redacted as a safety net.

type Level = "info" | "warn" | "error";

const REDACTED_KEYS = new Set([
  "password", "passwd", "token", "accesstoken", "secret",
  "pin", "otp", "hash", "key", "credential",
]);

function sanitize(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const entry = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg,
    ...(ctx ? { ctx: sanitize(ctx) } : {}),
  });
  // Route errors to stderr (Railway shows them separately), info/warn to stdout
  if (typeof process !== "undefined" && process.stdout) {
    (level === "error" ? process.stderr : process.stdout).write(entry + "\n");
  } else {
    (level === "error" ? console.error : console.log)(entry);
  }
}

export const log = {
  info:  (msg: string, ctx?: Record<string, unknown>) => write("info",  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => write("warn",  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};
