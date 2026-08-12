// Next.js instrumentation hook — runs once when the server starts.
// Sets up global error handlers so background crashes are logged before process exit.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    process.stderr.write(
      JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: "unhandledRejection", ctx: { reason: msg, stack } }) + "\n",
    );
    // Node.js will exit with code 1 after this handler — Railway auto-restarts
  });

  process.on("uncaughtException", (err: Error) => {
    process.stderr.write(
      JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: "uncaughtException", ctx: { message: err.message, stack: err.stack } }) + "\n",
    );
    process.exit(1); // Hard exit — Railway restarts the container
  });
}
