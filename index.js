const { fork } = require("child_process");
const fs = require("fs");

if (require.main === module) {
  // Load tokens
  const tokens = fs.readFileSync("tokens.txt", "utf-8").split("\n").filter(Boolean);

  const processes = [];

  tokens.forEach((token, i) => {
    const p = fork("worker.js", [token]); // pass token to worker
    console.log(`[MASTER] Spawned process ${i} for bot`);

    p.on("exit", (code) => {
      console.log(`[MASTER] Bot ${i} exited with code ${code}`);
    });

    processes.push(p);
  });

  // Optional: wait/join
  process.on("SIGINT", () => {
    console.log("🛑 Killing all processes...");
    processes.forEach(p => p.kill());
    process.exit(0);
  });
}
