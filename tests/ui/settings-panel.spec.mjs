/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { UIRenderer } from "../../scripts/services/ui-renderer.mjs";

function createSettingsScene(options = {}) {
  const extraKeybindItemCount = Number.isFinite(options.extraKeybindItemCount)
    ? options.extraKeybindItemCount
    : 0;

  const extraKeybindItems = Array.from({ length: extraKeybindItemCount }, (_, index) => ({
    id: `dummy-bind-${index}`,
    label: `占位键位-${index}`,
    description: "占位项",
    control: "keybind",
    binding: `settings.keybind.dummy${index}`,
    effect: "confirm",
    defaultValue: "F"
  }));

  return {
    pageId: "settings-page",
    scene: {
      page: {
        id: "settings-page",
        domain: "panel"
      },
      layers: [
        {
          id: "panel.content",
          depth: 2010,
          inputPolicy: "capture"
        }
      ],
      components: [
        {
          id: "settings-panel",
          type: "settingsPanel",
          layer: "panel.content",
          title: "设置",
          subtitle: "仅UI测试",
          backActionId: "back",
          style: {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          },
          categories: [
            {
              id: "display",
              label: "显示与性能",
              items: [
                {
                  id: "vsync",
                  label: "垂直同步",
                  description: "测试开关",
                  control: "toggle",
                  binding: "settings.display.vsync",
                  effect: "restart",
                  defaultValue: true
                },
                {
                  id: "master-volume",
                  label: "主音量",
                  description: "测试滑杆",
                  control: "slider",
                  binding: "settings.audio.masterVolume",
                  effect: "instant",
                  min: 0,
                  max: 100,
                  step: 1,
                  unit: "%",
                  defaultValue: 70
                }
              ]
            },
            {
              id: "keybind",
              label: "按键设置",
              items: [
                {
                  id: "keybind-interact",
                  label: "交互",
                  description: "按键测试",
                  control: "keybind",
                  binding: "settings.keybind.interact",
                  effect: "confirm",
                  defaultValue: "F"
                },
                ...extraKeybindItems
              ]
            }
          ]
        }
      ]
    },
    themeTokens: {
      colors: {
        panelBgMain: "#1a2125",
        panelBgSecondary: "#2c363a",
        panelBorder: "#b99a6c",
        btnPrimaryBg: "#e5c271",
        btnPrimaryText: "#1a2125",
        btnSecondaryBg: "#2c363a",
        btnSecondaryText: "#f3efe4",
        textPrimary: "#f3efe4"
      }
    }
  };
}

describe("settingsPanel UI interactions", () => {
  it("should update draft state and apply without dispatching runtime action", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const dispatchedActions = [];
    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher((actionId, payload) => {
      dispatchedActions.push({ actionId, payload });
    });

    renderer.renderScene(createSettingsScene());

    expect(root.textContent).toContain("已同步");

    const toggleButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "开启");
    expect(toggleButton).toBeTruthy();
    toggleButton.click();

    expect(root.textContent).toContain("未保存变更 1");

    const applyButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "应用");
    expect(applyButton).toBeTruthy();
    applyButton.click();

    expect(root.textContent).toContain("已同步");
    expect(dispatchedActions.length).toBe(0);
  });

  it("should ask confirmation when leaving with unsaved changes", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const dispatchedActions = [];
    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher((actionId, payload) => {
      dispatchedActions.push({ actionId, payload });
    });

    renderer.renderScene(createSettingsScene());

    const toggleButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "开启");
    expect(toggleButton).toBeTruthy();
    toggleButton.click();

    const backButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "返回");
    expect(backButton).toBeTruthy();
    backButton.click();

    expect(root.textContent).toContain("存在未保存变更");

    const discardButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "放弃并返回");
    expect(discardButton).toBeTruthy();
    discardButton.click();

    expect(dispatchedActions.length).toBe(1);
    expect(dispatchedActions[0].actionId).toBe("back");
  });

  it("should capture keybind and normalize escape to ESC", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher(() => {});

    renderer.renderScene(createSettingsScene());

    const keybindCategoryButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "按键设置");
    expect(keybindCategoryButton).toBeTruthy();
    keybindCategoryButton.click();

    const keybindButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "F");
    expect(keybindButton).toBeTruthy();
    keybindButton.click();

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    globalThis.dispatchEvent(event);

    expect(root.textContent).toContain("ESC");
    expect(root.textContent).toContain("未保存变更 1");
  });

  it("should preserve scroll position after rerender without requiring a prior scroll event", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher(() => {});

    renderer.renderScene(createSettingsScene({ extraKeybindItemCount: 30 }));

    const keybindCategoryButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "按键设置");
    expect(keybindCategoryButton).toBeTruthy();
    keybindCategoryButton.click();

    const listBefore = [...root.querySelectorAll("div")]
      .find((element) => element.style?.overflowY === "auto");
    expect(listBefore).toBeTruthy();

    listBefore.scrollTop = 180;

    const keybindButton = [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "F");
    expect(keybindButton).toBeTruthy();
    keybindButton.click();

    const listAfter = [...root.querySelectorAll("div")]
      .find((element) => element.style?.overflowY === "auto");
    expect(listAfter).toBeTruthy();
    expect(listAfter.scrollTop).toBe(180);
  });

  it("should keep slider node during input and rerender on change", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher(() => {});

    renderer.renderScene(createSettingsScene());

    const slider = root.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
    expect(root.textContent).toContain("已同步");

    slider.value = "55";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    const sliderAfterInput = root.querySelector('input[type="range"]');
    expect(sliderAfterInput).toBe(slider);
    expect(root.textContent).toContain("55%");
    expect(root.textContent).toContain("已同步");

    slider.dispatchEvent(new Event("change", { bubbles: true }));

    const sliderAfterChange = root.querySelector('input[type="range"]');
    expect(sliderAfterChange).toBeTruthy();
    expect(sliderAfterChange).not.toBe(slider);
    expect(root.textContent).toContain("未保存变更 1");
  });
});
