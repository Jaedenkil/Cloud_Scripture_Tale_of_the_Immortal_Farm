import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";

const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  clearScreen: false
});

await vite.listen();

const address = vite.httpServer?.address();
const port = typeof address === "object" && address ? address.port : 5173;
const devServerUrl = `http://127.0.0.1:${port}`;

console.log(`[start] Vite dev server: ${devServerUrl}`);

const electronProcess = spawn(electron, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    VITE_DEV_SERVER_URL: devServerUrl
  }
});

const shutdown = async () => {
  if (!electronProcess.killed) {
    electronProcess.kill();
  }
  await vite.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

electronProcess.on("exit", async (code) => {
  await vite.close();
  process.exit(code ?? 0);
});
