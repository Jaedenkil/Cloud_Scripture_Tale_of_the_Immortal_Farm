import { AppBootstrap } from "../../scripts/services/app-bootstrap.mjs";

async function boot () {
  try {
    const app = new AppBootstrap({
      registryPath: "scenes/ui-registry.yaml",
      flowPath: "scenes/ui-flow.yaml",
      themePath: "scenes/theme.yaml",
      rootElement: document.body,
      actionChannel: "ui.action"
    });

    await app.init();
    globalThis.__appBootstrap = app;
  } catch (error) {
    console.error("[boot] failed:", error);
    document.body.innerHTML =
      `<pre style="padding:16px;color:#b00020;background:#fff;">${String(error?.stack || error?.message || error)}</pre>`;
  }
}

void boot();