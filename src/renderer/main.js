import Phaser from 'phaser'
import {
  getPageConfig,
  getResourceTypes,
  styleParamsConfig,
  themeConfig,
  uiIndex
} from './page-registry.js'

function toCssSize(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'number') {
    return `${value}px`
  }
  return String(value)
}

function toCssNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const workbench = getPageConfig('dev-tools-workbench') || {}
const mainMenu = getPageConfig('main-menu') || {}
const gameHud = getPageConfig('game-hud') || {}
const settingsPage = getPageConfig('settings') || {}
const settingsSections = settingsPage?.page?.sections || settingsPage?.layout?.sections || []
const settingsResolutionOptions = settingsSections?.[0]?.fields?.[0]?.options || []

const root = document.getElementById('app')

const state = {
  activePage: uiIndex.ui.defaultPage || 'main-menu',
  categoryId: workbench.categories[0]?.id || '',
  toolId: workbench.categories[0]?.tools[0] || '',
  phaserGame: null,
  notice: '',
  selectedResolutionId: settingsResolutionOptions?.[0]?.id || '',
  currentResolutionText: ''
}

function getToolById(toolId) {
  return workbench.tools.find((tool) => tool.id === toolId)
}

function getCategoryById(categoryId) {
  return workbench.categories.find((category) => category.id === categoryId)
}

function getThemeLookup() {
  const palette = themeConfig.theme.palette
  const textTypes = Object.fromEntries(themeConfig.theme.textTypes.map((item) => [item.id, item]))
  const buttonTypes = Object.fromEntries(themeConfig.theme.buttonTypes.map((item) => [item.id, item]))
  const borderTypes = Object.fromEntries(themeConfig.theme.borderTypes.map((item) => [item.id, item]))
  return {
    palette,
    textTypes,
    buttonTypes,
    borderTypes
  }
}

function applyStyles() {
  const { palette, textTypes } = getThemeLookup()
  const commonStyle = styleParamsConfig?.style?.common || {}
  const menuStyle = mainMenu?.layout?.style || {}
  const settingsStyle = settingsPage?.layout?.style || {}
  const workbenchStyle = workbench?.layout?.style || {}
  const gameHudStyle = gameHud?.layout?.style || {}
  const appPaddingPx = toCssNumber(commonStyle.appPadding, 18)
  const panelGap = toCssSize(commonStyle.panelGap, '14px')
  const panelRadius = toCssSize(commonStyle.panelRadius, '12px')
  const panelPadding = toCssSize(commonStyle.panelPadding, '14px')
  const layoutColumns = workbenchStyle.columns || '270px minmax(420px, 1fr) 320px'
  const mobileBreakpoint = toCssNumber(commonStyle.mobileBreakpoint, 1220)

  const style = document.createElement('style')
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    @font-face {
      font-family: 'zpix';
      src: local('zpix'), url('https://cdn.jsdelivr.net/gh/SolidZORO/zpix-pixel-font@master/dist/zpix.ttf') format('truetype');
      font-display: swap;
    }

    :root {
      --sky-300: ${palette.sky[300]};
      --sky-500: ${palette.sky[500]};
      --sky-700: ${palette.sky[700]};
      --cloud-100: ${palette.cloud[100]};
      --cloud-300: ${palette.cloud[300]};
      --cloud-500: ${palette.cloud[500]};
      --cloud-700: ${palette.cloud[700]};
      --black-100: ${palette.black[100]};
      --black-300: ${palette.black[300]};
      --black-500: ${palette.black[500]};
      --black-900: ${palette.black[900]};
      --font-display: ${textTypes.display.fontFamily};
      --font-title: ${textTypes.title.fontFamily};
      --font-body: ${textTypes.body.fontFamily};
    }

    body {
      margin: 0;
      background: radial-gradient(circle at 20% 0%, var(--black-100) 0%, var(--black-900) 58%);
      color: var(--cloud-300);
      font-family: var(--font-body);
    }

    #app {
      min-height: 100vh;
      box-sizing: border-box;
      padding: ${appPaddingPx}px;
      overflow: hidden;
    }

    .layout {
      display: grid;
      grid-template-columns: ${layoutColumns};
      gap: ${panelGap};
      min-height: calc(100vh - ${appPaddingPx * 2}px);
      max-width: calc(100vw - ${appPaddingPx * 2}px);
    }

    .panel {
      background: linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%);
      border: 1px solid rgba(142, 163, 184, 0.35);
      border-radius: ${panelRadius};
      padding: ${panelPadding};
      box-sizing: border-box;
      min-height: 0;
      overflow: hidden;
    }

    .panel h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 32px;
      color: var(--cloud-100);
    }

    .panel h2 {
      margin: 0;
      font-family: var(--font-title);
      font-size: 24px;
      color: var(--sky-300);
    }

    .panel h3 {
      margin: 0 0 8px;
      font-size: 20px;
      color: var(--sky-300);
    }

    .menu-shell {
      width: 100%;
      min-height: calc(100vh - ${appPaddingPx * 2}px);
      display: grid;
      grid-template-rows: ${menuStyle.rowsDesktop || '0.28fr 0.38fr 0.18fr 0.16fr'};
      overflow: hidden;
    }

    .menu-zone {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${toCssSize(menuStyle.zonePaddingY, '10px')} ${toCssSize(menuStyle.zonePaddingX, '16px')};
      box-sizing: border-box;
    }

    .menu-zone-top {
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
    }

    .menu-zone-middle {
      flex-direction: column;
      justify-content: center;
    }

    .menu-title {
      font-family: var(--font-display);
      color: var(--cloud-100);
      margin: 0;
      font-size: ${toCssSize(menuStyle.titleSize, '56px')};
      text-align: center;
      letter-spacing: 3px;
    }

    .menu-tagline {
      margin: 0;
      text-align: center;
      color: var(--sky-300);
      font-size: ${toCssSize(menuStyle.taglineSize, '20px')};
      font-family: var(--font-title);
    }

    .menu-btn-list {
      display: grid;
      gap: ${toCssSize(commonStyle.menuButtonListGap, '10px')};
      width: min(100%, ${toCssSize(menuStyle.buttonListWidth, '380px')});
      margin: 0;
    }

    .menu-btn {
      width: 100%;
      border-radius: ${toCssSize(commonStyle.menuButtonRadius, '10px')};
      padding: ${toCssSize(commonStyle.menuButtonPaddingY, '11px')} ${toCssSize(commonStyle.menuButtonPaddingX, '14px')};
      text-align: center;
      font-size: ${toCssSize(commonStyle.menuButtonFontSize, '18px')};
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }

    .menu-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px rgba(120, 200, 255, 0.5) inset;
    }

    .menu-desc {
      margin-top: 0;
      font-size: ${toCssSize(menuStyle.descriptionFontSize, '14px')};
      color: var(--cloud-700);
      text-align: center;
      min-height: 20px;
    }

    .menu-footer-note {
      font-size: ${toCssSize(menuStyle.footerNoteFontSize, '13px')};
      color: var(--cloud-700);
      text-align: center;
    }

    .settings-shell {
      max-width: ${toCssSize(settingsStyle.shellMaxWidth, '980px')};
      margin: 0 auto;
      min-height: calc(100vh - ${appPaddingPx * 2}px);
      display: grid;
      place-items: center;
    }

    .settings-card {
      width: min(100%, ${toCssSize(settingsStyle.cardWidth, '760px')});
      background: linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%);
      border: 1px solid rgba(142, 163, 184, 0.35);
      border-radius: ${toCssSize(settingsStyle.cardRadius, '14px')};
      padding: ${toCssSize(settingsStyle.cardPadding, '22px')};
      box-sizing: border-box;
    }

    .settings-title {
      margin: 0;
      font-size: ${toCssSize(settingsStyle.titleSize, '40px')};
      color: var(--cloud-100);
      font-family: var(--font-display);
      text-align: center;
    }

    .settings-desc {
      margin-top: 8px;
      font-size: 15px;
      color: var(--cloud-700);
      text-align: center;
    }

    .settings-section {
      margin-top: ${toCssSize(settingsStyle.sectionMarginTop, '18px')};
      padding: ${toCssSize(settingsStyle.sectionPadding, '14px')};
      border: 1px dashed rgba(61, 168, 245, 0.6);
      border-radius: ${toCssSize(settingsStyle.sectionRadius, '10px')};
      background: rgba(9, 12, 16, 0.75);
    }

    .settings-section-title {
      margin: 0;
      font-size: 22px;
      color: var(--sky-300);
      font-family: var(--font-title);
    }

    .settings-field {
      margin-top: 12px;
    }

    .settings-label {
      font-size: 16px;
      color: var(--cloud-300);
      margin-bottom: 6px;
      display: block;
    }

    .settings-help {
      margin-top: 6px;
      font-size: 13px;
      color: var(--cloud-700);
    }

    .settings-select {
      width: 100%;
      box-sizing: border-box;
      background: var(--black-300);
      color: var(--cloud-100);
      border: 1px solid rgba(120, 200, 255, 0.45);
      border-radius: 8px;
      padding: 10px;
      font-size: 15px;
    }

    .settings-actions {
      margin-top: 14px;
      display: flex;
      gap: 10px;
    }

    .settings-status {
      margin-top: 12px;
      color: var(--cloud-500);
      font-size: 14px;
      min-height: 20px;
    }

    .inline-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .btn-inline {
      width: auto;
      font-size: 13px;
      padding: 6px 10px;
    }

    .meta {
      font-size: 14px;
      color: var(--cloud-700);
      margin-top: 6px;
    }

    .category-list,
    .tool-list,
    .card-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      max-height: ${workbenchStyle.cardListMaxHeight || 'calc(100vh - 180px)'};
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }

    .dev-shell {
      min-height: calc(100vh - ${appPaddingPx * 2}px);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 10px;
      overflow: hidden;
    }

    .dev-hero {
      min-height: ${toCssSize(workbenchStyle.heroMinHeight, '180px')};
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px 0 6px;
      border-bottom: 1px solid rgba(120, 200, 255, 0.25);
    }

    .dev-hero-copy {
      display: grid;
      gap: 6px;
      max-width: 680px;
    }

    .dev-kicker {
      color: var(--sky-300);
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .dev-title {
      margin: 0;
      font-family: var(--font-display);
      font-size: 26px;
      line-height: 1.1;
      color: var(--cloud-100);
    }

    .dev-subtitle {
      margin: 0;
      max-width: 620px;
      color: var(--cloud-700);
      font-size: 13px;
      line-height: 1.5;
    }

    .dev-status-line {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: var(--cloud-700);
      font-size: 12px;
    }

    .dev-status-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(120, 200, 255, 0.5);
      padding: 2px 6px;
      color: var(--sky-300);
      background: rgba(9, 12, 16, 0.8);
    }

    .dev-category-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: ${toCssSize(workbenchStyle.categoryGap, '10px')};
      overflow: hidden;
    }

    .dev-category-btn,
    .dev-tool-btn,
    .btn,
    .menu-btn {
      border-radius: 0;
    }

    .dev-category-btn,
    .dev-tool-btn {
      width: 100%;
      padding: 10px 12px;
      text-align: left;
      cursor: pointer;
      transition: transform 0.08s steps(2, end), box-shadow 0.08s steps(2, end), background-color 0.08s steps(2, end);
      background: var(--black-300);
      color: var(--cloud-300);
      border: 1px solid rgba(142, 163, 184, 0.45);
      box-sizing: border-box;
    }

    .dev-category-btn:hover,
    .dev-tool-btn:hover,
    .btn:hover,
    .menu-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.95);
    }

    .dev-category-name,
    .dev-tool-name {
      display: block;
      color: var(--cloud-100);
      font-size: 14px;
      line-height: 1.35;
    }

    .dev-category-meta,
    .dev-tool-meta {
      display: block;
      margin-top: 4px;
      color: var(--cloud-700);
      font-size: 11px;
      line-height: 1.45;
    }

    .dev-shell {
      height: calc(100vh - ${appPaddingPx * 2}px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }

    .dev-main {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: ${workbenchStyle.contentColumns || 'minmax(340px, 0.92fr) minmax(420px, 1.08fr)'};
      gap: 12px;
      overflow: hidden;
    }

    .dev-column {
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 8px;
    }

    .dev-tool-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      align-content: start;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }

    .dev-sys-info {
      height: 100px;
      flex-shrink: 0;
      padding: 10px;
      background: rgba(9, 12, 16, 0.8);
      border: 1px solid rgba(142, 163, 184, 0.25);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 11px;
      color: var(--cloud-500);
      overflow: hidden;
    }
    .dev-sys-info-row { display: flex; justify-content: space-between; }
    .dev-sys-info-val { color: var(--cloud-100); }

    .dev-focus {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: ${toCssSize(workbenchStyle.statusPanelPadding, '16px')};
      border: 1px solid rgba(120, 200, 255, 0.4);
      background: linear-gradient(180deg, rgba(16, 20, 25, 0.96) 0%, rgba(5, 7, 10, 0.92) 100%);
      overflow: hidden;
    }

    .dev-focus-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }

    .dev-focus-head-left {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .dev-focus-head-right {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: right;
    }

    .dev-stage {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px dashed rgba(61, 168, 245, 0.62);
      background:
        linear-gradient(180deg, rgba(9, 12, 16, 0.82) 0%, rgba(9, 12, 16, 0.92) 100%),
        linear-gradient(rgba(120, 200, 255, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(120, 200, 255, 0.08) 1px, transparent 1px);
      background-size: auto, 28px 28px, 28px 28px;
      overflow: hidden;
    }

    .dev-stage-copy {
      display: grid;
      align-content: center;
      justify-items: start;
      gap: 10px;
      max-width: 420px;
    }

    .dev-stage-kicker {
      color: var(--sky-300);
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .dev-stage-title {
      margin: 0;
      color: var(--cloud-100);
      font-size: 18px;
      font-family: var(--font-title);
      line-height: 1.4;
    }

    .dev-stage-desc {
      margin: 0;
      color: var(--cloud-500);
      font-size: 13px;
      line-height: 1.6;
    }

    .dev-stage-band {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      align-content: end;
    }

    .dev-stage-cell {
      display: grid;
      gap: 4px;
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.26);
      border: 1px solid rgba(142, 163, 184, 0.28);
    }

    .dev-stage-label {
      color: var(--cloud-700);
      font-size: 11px;
    }

    .dev-stage-value {
      color: var(--cloud-100);
      font-size: 13px;
      line-height: 1.45;
    }

    .dev-focus-status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0;
      border: 0;
      background: transparent;
    }

    .dev-focus-status strong,
    .dev-focus-status p {
      margin: 0;
      padding: 5px 8px;
      color: var(--cloud-500);
      font-size: 12px;
      line-height: 1.4;
      border: 1px solid rgba(142, 163, 184, 0.24);
      background: rgba(9, 12, 16, 0.45);
    }

    .dev-focus-status strong {
      color: var(--cloud-100);
      border-color: rgba(120, 200, 255, 0.45);
    }

    .dev-scope-list {
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-content: start;
      gap: 8px;
      overflow-y: hidden;
      overflow-x: hidden;
    }

    .dev-scope-item {
      display: grid;
      gap: 4px;
      padding: 8px 10px;
      border-left: 2px solid var(--sky-500);
      background: rgba(9, 12, 16, 0.58);
    }

    .dev-scope-title {
      color: var(--cloud-100);
      font-size: 14px;
    }

    .dev-scope-meta {
      color: var(--cloud-700);
      font-size: 11px;
      line-height: 1.45;
    }

    .hud-shell {
      width: 100%;
      min-height: calc(100vh - ${appPaddingPx * 2}px);
      display: grid;
      grid-template-rows: ${gameHudStyle.rows || '0.2fr 0.58fr 0.22fr'};
      gap: ${toCssSize(gameHudStyle.sectionGap, '12px')};
      overflow: hidden;
    }

    .hud-strip,
    .hud-stage,
    .hud-actions {
      border: 1px solid rgba(142, 163, 184, 0.35);
      border-radius: ${toCssSize(gameHudStyle.sectionRadius, '12px')};
      background: linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%);
      box-sizing: border-box;
      overflow: hidden;
    }

    .hud-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      padding: ${toCssSize(gameHudStyle.stripPadding, '12px')};
    }

    .hud-item {
      border: 1px dashed rgba(61, 168, 245, 0.6);
      border-radius: 8px;
      padding: 8px 10px;
      min-width: 0;
    }

    .hud-item-label {
      font-size: 12px;
      color: var(--cloud-700);
    }

    .hud-item-value {
      margin-top: 4px;
      font-size: 16px;
      color: var(--cloud-100);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hud-stage {
      display: grid;
      place-items: center;
      padding: 16px;
      text-align: center;
    }

    .hud-title {
      margin: 0;
      font-family: var(--font-display);
      color: var(--cloud-100);
      font-size: ${toCssSize(gameHudStyle.titleSize, '42px')};
    }

    .hud-subtitle {
      margin-top: 8px;
      font-size: ${toCssSize(gameHudStyle.subtitleSize, '20px')};
      color: var(--sky-300);
      font-family: var(--font-title);
    }

    .hud-desc {
      margin-top: 10px;
      color: var(--cloud-500);
      font-size: ${toCssSize(gameHudStyle.descFontSize, '15px')};
      max-width: 760px;
    }

    .hud-actions {
      padding: ${toCssSize(gameHudStyle.actionPadding, '12px')};
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      align-content: center;
    }

    .btn {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 0;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      transition: transform 0.08s steps(2, end), box-shadow 0.08s steps(2, end), background-color 0.08s steps(2, end);
      background: var(--black-300);
      color: var(--cloud-300);
      border: 1px solid rgba(142, 163, 184, 0.35);
    }

    .btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.95);
    }

    .btn.active {
      color: #000;
      background: var(--sky-500);
      border-color: var(--sky-300);
    }

    .preview-shell {
      margin-top: 12px;
      border: 2px solid var(--sky-300);
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      min-height: 460px;
      position: relative;
    }

    #preview-surface {
      width: 100%;
      min-height: 460px;
    }

    .card-item {
      border: 1px dashed rgba(61, 168, 245, 0.7);
      border-radius: 10px;
      padding: 10px;
      background: rgba(9, 12, 16, 0.9);
    }

    .card-item-title {
      font-size: 16px;
      color: var(--cloud-100);
      margin-bottom: 8px;
    }

    .chip-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      border-radius: 999px;
      border: 1px solid rgba(198, 216, 234, 0.45);
      padding: 2px 8px;
      font-size: 12px;
      color: var(--cloud-500);
    }

    .spec-preview {
      margin-top: 14px;
      border-top: 1px solid rgba(142, 163, 184, 0.3);
      padding-top: 12px;
      display: grid;
      gap: 10px;
    }

    .text-sample {
      border: 1px solid rgba(142, 163, 184, 0.35);
      border-radius: 8px;
      padding: 8px;
    }

    @media (max-width: ${mobileBreakpoint}px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .dev-hero,
      .dev-main {
        grid-template-columns: 1fr;
      }

      .dev-category-strip,
      .dev-tool-grid,
      .dev-stage-band,
      .dev-scope-list {
        grid-template-columns: 1fr;
      }

      .hud-strip,
      .hud-actions {
        grid-template-columns: 1fr;
      }

      .menu-shell {
        grid-template-rows: ${menuStyle.rowsMobile || '0.30fr 0.36fr 0.20fr 0.14fr'};
      }
    }
  `
  document.head.appendChild(style)
}

function getButtonType(typeId) {
  return themeConfig.theme.buttonTypes.find((item) => item.id === typeId)
}

function getButtonStyle(typeId) {
  const type = getButtonType(typeId)
  if (!type) {
    return 'background:#101419;color:#EAF4FF;border:1px solid #8EA3B8;'
  }
  const border = type.border ? `${type.borderWidth}px solid ${type.borderColor}` : 'none'
  return `background:${type.background};color:${type.textColor};border:${border};`
}

function renderMainMenu() {
  const menuConfig = mainMenu?.page || {}
  const menuHero = menuConfig.hero || mainMenu?.hero || {}
  const menuButtonSource = menuConfig.buttons || mainMenu?.buttons || []
  const menuButtons = menuButtonSource
    .map((button) => {
      return `
        <button
          class="menu-btn"
          style="${getButtonStyle(button.type)}"
          data-menu-action="${button.action}"
          data-menu-description="${button.description}"
        >
          ${button.text}
        </button>
      `
    })
    .join('')

  root.innerHTML = `
    <div class="menu-shell">
      <section class="menu-zone menu-zone-top">
        <h1 class="menu-title">${menuHero.title || '云笈仙田录'}</h1>
        <p class="menu-tagline">${menuHero.tagline || '归云入田，问道成仙'}</p>
      </section>
      <section class="menu-zone menu-zone-middle">
        <div class="menu-btn-list">${menuButtons}</div>
      </section>
      <section class="menu-zone">
        <div class="menu-desc">${state.notice || menuConfig.description || mainMenu?.description || '配置驱动游戏主页'}</div>
      </section>
      <section class="menu-zone">
        <div class="menu-footer-note">主体开放式首页：保留整窗留白与分区，不使用整体封闭卡片。</div>
      </section>
    </div>
  `
  bindMainMenuEvents()
}

function renderGameHud() {
  const hudConfig = gameHud?.page || {}
  const summaryItems = gameHud?.summary || []
  const hudActions = gameHud?.actions || []

  const summaryHtml = summaryItems
    .map((item) => {
      return `
        <div class="hud-item">
          <div class="hud-item-label">${item.label}</div>
          <div class="hud-item-value">${item.value}</div>
        </div>
      `
    })
    .join('')

  const actionHtml = hudActions
    .map((action) => {
      return `<button class="menu-btn" style="${getButtonStyle(action.type)}" data-hud-action="${action.id}">${action.text}</button>`
    })
    .join('')

  root.innerHTML = `
    <div class="hud-shell">
      <section class="hud-strip">${summaryHtml}</section>
      <section class="hud-stage">
        <h1 class="hud-title">${hudConfig.name || '云笈仙田录 · 游戏内'}</h1>
        <div class="hud-subtitle">${hudConfig.subtitle || '灵田经营进行中'}</div>
        <div class="hud-desc">${state.notice || hudConfig.description || '游戏主界面占位页，后续将接入真实 HUD 与世界交互。'}</div>
      </section>
      <section class="hud-actions">${actionHtml}</section>
    </div>
  `

  root.querySelectorAll('[data-hud-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.hudAction
      if (action === 'back-main') {
        executeMenuAction('open-main-menu', '返回首页')
        return
      }
      if (action === 'open-settings') {
        executeMenuAction('open-settings', '打开系统设置')
        return
      }
      if (action === 'open-devtools') {
        executeMenuAction('open-devtools', '进入开发工具总控台')
      }
    })
  })
}

function getSelectedResolutionOption() {
  const options = settingsPage?.page?.sections?.[0]?.fields?.[0]?.options || []
  return options.find((option) => option.id === state.selectedResolutionId) || options[0] || null
}

async function refreshCurrentResolutionText() {
  if (!window.electronAPI?.getWindowResolution) {
    return
  }
  try {
    const result = await window.electronAPI.getWindowResolution()
    state.currentResolutionText = `${result.width} x ${result.height}`
  } catch (error) {
    state.currentResolutionText = '读取失败'
  }
}

function renderSettingsPage() {
  const section = settingsPage?.page?.sections?.[0] || settingsPage?.layout?.sections?.[0]
  const field = section?.fields?.[0]
  if (!section || !field) {
    root.innerHTML = `
      <div class="settings-shell">
        <section class="settings-card">
          <h1 class="settings-title">设置</h1>
          <p class="settings-desc">设置配置缺失，请检查 settings.yaml。</p>
          <div class="settings-status">当前窗口分辨率：${state.currentResolutionText || '读取中'}</div>
        </section>
      </div>
    `
    return
  }
  const options = field.options
    .map((option) => {
      const selected = option.id === state.selectedResolutionId ? 'selected' : ''
      return `<option value="${option.id}" ${selected}>${option.label}</option>`
    })
    .join('')

  const actionList = settingsPage?.page?.actions || settingsPage?.layout?.actions || []
  const actions = actionList
    .map((action) => {
      return `<button class="menu-btn" style="${getButtonStyle(action.type)}" data-settings-action="${action.id}">${action.text}</button>`
    })
    .join('')

  root.innerHTML = `
    <div class="settings-shell">
      <section class="settings-card">
        <h1 class="settings-title">${settingsPage.page.name}</h1>
        <p class="settings-desc">${settingsPage.page.description}</p>
        <div class="settings-section">
          <h2 class="settings-section-title">${section.title}</h2>
          <div class="settings-field">
            <label class="settings-label">${field.label}</label>
            <select class="settings-select" data-settings-field="resolution">${options}</select>
            <div class="settings-help">${field.description}</div>
          </div>
          <div class="settings-actions">${actions}</div>
          <div class="settings-status">当前窗口分辨率：${state.currentResolutionText || '读取中'} ${state.notice ? `| ${state.notice}` : ''}</div>
        </div>
      </section>
    </div>
  `

  bindSettingsEvents()
}

function renderTextSpecPreview() {
  return themeConfig.theme.textTypes
    .map((item) => {
      return `
        <div class="text-sample" style="font-family:${item.fontFamily};font-size:${item.size}px;color:${item.color};">
          ${item.id.toUpperCase()} 示例文字
          <div class="meta">${item.usage}</div>
        </div>
      `
    })
    .join('')
}

function renderButtonSpecPreview() {
  return themeConfig.theme.buttonTypes
    .map((item) => {
      const border = item.border ? `${item.borderWidth}px solid ${item.borderColor}` : 'none'
      return `<button class="btn" style="background:${item.background};color:${item.textColor};border:${border};cursor:default;">${item.id.toUpperCase()} 按钮</button>`
    })
    .join('')
}

function renderBorderSpecPreview() {
  return themeConfig.theme.borderTypes
    .map((item) => {
      const dash = item.dashed ? 'dashed' : 'solid'
      return `<div style="border:${item.strokeWidth}px ${dash} ${item.strokeColor};background:${item.background};border-radius:8px;padding:8px;color:#c6d8ea;font-size:13px;">${item.id} / ${item.strokeWidth}px</div>`
    })
    .join('')
}

function normalizeFields(fields) {
  if (Array.isArray(fields)) {
    return fields
  }
  if (typeof fields === 'string') {
    return fields
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function getWorkbenchTemplateByToolId(toolId) {
  if (toolId === 'resource-browser') {
    return 'resource-browser'
  }
  return 'default'
}

let cachedResourceIndex = null
let resourceBrowserState = {
  typeKey: getResourceTypes()[0]?.key || 'texture',
  selectedId: null
}

async function loadResourceIndex() {
  if (cachedResourceIndex) return cachedResourceIndex
  try {
    // Load from vite server during dev or use a proper IPC call in production.
    // For now we fetch the report json from dev server if available, or just mock fallback since we're in UI rendering phase
    const res = await fetch('/storage/cache/resource-index.report.json')
    if (res.ok) {
      cachedResourceIndex = await res.json()
      return cachedResourceIndex
    }
  } catch (e) {
    console.warn("Failed to load resource index, using empty state", e)
  }
  return { items: [], issues: [] }
}

function renderResourceBrowserStage() {
  const types = getResourceTypes()

  const typeButtons = types.map(t => {
    const active = resourceBrowserState.typeKey === t.key ? 'primary' : 'secondary'
    return `<button class="btn" style="${getButtonStyle(active)}" data-res-type="${t.key}">${t.name}</button>`
  }).join('')

  const data = cachedResourceIndex || { items: [] }
  const items = data.items.filter(i => i.type === resourceBrowserState.typeKey)
  
  const selectedItem = items.find(i => i.id === resourceBrowserState.selectedId)

  const itemListHtml = items.map(item => {
    const isSelected = item.id === resourceBrowserState.selectedId
    const hasError = item.issues && item.issues.length > 0
    const bg = isSelected ? 'rgba(61, 168, 245, 0.2)' : (hasError ? 'rgba(245, 61, 61, 0.1)' : 'rgba(9, 12, 16, 0.6)')
    const border = hasError ? '1px dashed #f53d3d' : '1px solid rgba(142, 163, 184, 0.3)'
    return `
      <div class="dev-stage-cell" style="background: ${bg}; border: ${border}; cursor:pointer;" data-res-id="${item.id}">
        <div class="dev-stage-value">${item.id}</div>
        <div class="dev-stage-label">${item.sourcePath}</div>
      </div>
    `
  }).join('') || '<div class="dev-stage-label" style="padding: 10px;">该分类下暂无资源</div>'

  let detailHtml = '<div class="dev-stage-label" style="padding: 10px;">点击左侧资源查看详情</div>'
  if (selectedItem) {
    const refs = (selectedItem.references || []).map(r => `<div>${r}</div>`).join('') || '无引用'
    const fallbacks = (selectedItem.fallbackChain || []).map(f => `<div>[${f.level}] ${f.status === 'hit' ? '✅' : '❌'} ${f.path || ''}</div>`).join('')
    const issues = (selectedItem.issues || []).map(i => `<div style="color:#f53d3d;">⚠️ ${i}</div>`).join('') || '<div style="color:#2ecc71;">✅ 校验通过</div>'
    
    // T15: 地块资源专项提示
    let tileHint = ''
    if (selectedItem.type === 'texture' && selectedItem.id && selectedItem.id.includes('_')) {
        const partsCheck = ['top', 'side-left', 'side-right', 'transition', 'variant']
        const hasParts = partsCheck.map(p => `[${selectedItem.id.includes(p) ? '✅' : ' '}] ${p}`).join(' ')
        tileHint = `<div style="margin-top:10px; padding: 10px; background: rgba(0,0,0,0.3); border: 1px dashed var(--sky-500);"><strong>地块专项检测:</strong> <br/>${hasParts}</div>`
    }

    let mediaPreview = ''
    if (selectedItem.type === 'texture') {
      mediaPreview = `
        <div style="margin-top:10px; background: rgba(0,0,0,0.5); border: 1px solid var(--cloud-800); border-radius: 4px; padding: 10px; display: flex; align-items: center; justify-content: center; height: 180px; flex-shrink: 0;">
          <img src="/${selectedItem.runtimePath || selectedItem.sourcePath}" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated;" />
        </div>
      `
    } else if (selectedItem.type === 'audio') {
      mediaPreview = `
        <div style="margin-top:10px; background: rgba(0,0,0,0.5); border: 1px solid var(--cloud-800); border-radius: 4px; padding: 10px; display: flex; align-items: center; justify-content: center;">
          <audio controls src="/${selectedItem.runtimePath || selectedItem.sourcePath}" style="width: 100%; height: 32px; outline: none;"></audio>
        </div>
      `
    }

    detailHtml = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; min-height: 0; overflow-y: auto; overflow-x: hidden;">
        <h4 style="margin:0; color: var(--cloud-100); font-family: var(--font-title);">${selectedItem.id}</h4>
        <div style="font-size: 12px; color: var(--cloud-500);">${selectedItem.sourcePath}</div>
        ${mediaPreview}
        <hr style="border: 0; border-top: 1px solid rgba(142, 163, 184, 0.3); width: 100%;" />
        
        <div><strong>校验结果:</strong><br/>${issues}</div>
        ${tileHint}
        
        <div><strong>引用追踪:</strong><br/>
          <div class="dev-stage-label" style="background: rgba(0,0,0,0.2); padding: 5px;">${refs}</div>
        </div>
        
        <div><strong>回退链分析:</strong><br/>
          <div class="dev-stage-label" style="background: rgba(0,0,0,0.2); padding: 5px;">${fallbacks}</div>
        </div>
      </div>
    `
  }

  return `
    <div class="dev-stage" data-template-id="resource-browser" style="display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 16px;">
      <div style="flex-shrink: 0; display: flex; gap: 8px; border-bottom: 1px solid rgba(142, 163, 184, 0.3); padding-bottom: 10px; overflow-x: hidden;">
        ${typeButtons}
      </div>
      <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 0; overflow: hidden;">
        <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overflow-x: hidden; padding-right: 5px;">
          ${itemListHtml}
        </div>
        <div style="border-left: 1px dashed rgba(61, 168, 245, 0.62); padding-left: 16px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; min-height: 0;">
          ${detailHtml}
        </div>
      </div>
    </div>
  `
}

function renderWorkbench() {
  const category = getCategoryById(state.categoryId)
  const currentTool = getToolById(state.toolId)
  const templateId = getWorkbenchTemplateByToolId(currentTool?.id)
  const isResourceBrowser = templateId === 'resource-browser'
  const sections = workbench?.layout?.sections || {}
  const heroSection = sections.hero || {}
  const categorySection = sections.category || {}
  const contentSection = sections.content || {}
  const categoryButtons = workbench.categories
    .map((item) => {
      const buttonStyle = getButtonStyle(item.id === state.categoryId ? 'primary' : 'secondary')
      return `
        <button class="dev-category-btn" style="${buttonStyle}" data-category-id="${item.id}">
          <span class="dev-category-name">${item.name}</span>
          <span class="dev-category-meta">${item.summary || '开发工具分类'}</span>
        </button>
      `
    })
    .join('')

  const toolButtons = (category?.tools || [])
    .map((toolId) => {
      const tool = getToolById(toolId)
      if (!tool) {
        return ''
      }
      const buttonStyle = getButtonStyle(tool.id === state.toolId ? 'primary' : 'ghost')
      return `
        <button class="dev-tool-btn" style="${buttonStyle}" data-tool-id="${tool.id}">
          <span class="dev-tool-name">${tool.name}</span>
          <span class="dev-tool-meta">${tool.summary}</span>
        </button>
      `
    })
    .join('')

  const scopes = (currentTool?.cards || [])
    .map((card) => {
      const labels = normalizeFields(card.fields).join(' / ')
      return `
        <div class="dev-scope-item">
          <div class="dev-scope-title">${card.title}</div>
          <div class="dev-scope-meta">${labels || '待补充'}</div>
        </div>
      `
    })
    .join('')

  const stageMarkup = isResourceBrowser
    ? renderResourceBrowserStage()
    : `
      <div class="dev-stage" data-template-id="default">
        <div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--cloud-700)">
           该工具区域当前为空视图，准备用于画布挂载。
        </div>
      </div>
    `

  root.innerHTML = `
    <div class="dev-shell">
      <section class="dev-hero">
        <div class="dev-hero-copy">
          <div class="dev-kicker">${heroSection.badge || '开发工具导航'}</div>
          <h1 class="dev-title">${workbench.page.name}</h1>
          <p class="dev-subtitle">${workbench.page.subtitle || workbench.page.description || ''}</p>
          <div class="dev-status-line">
            <span class="dev-status-chip">${category?.name || '未选分类'}</span>
            <span>${workbench.page.statusNote || '当前页面仅实现工具间切换。'}</span>
          </div>
        </div>
        <div class="inline-actions">
          <button class="btn btn-inline" data-menu-action="open-main-menu">${heroSection.primaryAction?.text || '返回首页'}</button>
        </div>
      </section>

      <section>
        <h2 class="dev-section-title">${categorySection.title || '分类切换'}</h2>
        <p class="dev-section-desc">${categorySection.description || ''}</p>
        <div class="dev-category-strip">${categoryButtons}</div>
      </section>

      <section class="dev-main">
        <div class="dev-column">
          <div>
            <h2 class="dev-section-title">${contentSection.leftTitle || '工具列表'}</h2>
            <p class="dev-section-desc">${category?.summary || '从当前分类中切换目标工具。'}</p>
          </div>
          <div class="dev-tool-grid">${toolButtons}</div>
        </div>

        <div class="dev-column">
          <div>
            <h2 class="dev-section-title">${isResourceBrowser ? '工作面板' : (contentSection.rightTitle || '当前工具')}</h2>
          </div>
        <section class="dev-focus">
          <div class="dev-focus-head" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="dev-focus-head-left" style="display:flex; align-items:flex-end; gap:8px;">
              <h3 class="dev-focus-title" style="margin:0; font-size:22px; color:var(--cloud-100);">${currentTool?.name || '未选择'}</h3>
              <span class="dev-focus-kicker" style="font-size:12px; color:var(--cloud-700);">${category?.name || '未选'}</span>
            </div>
            <div class="dev-focus-head-right" style="display:flex; align-items:center; gap:12px;">
              <span class="chip" style="color:var(--sky-300); border-color:var(--sky-500); padding:2px 8px; font-size:12px; border-radius:12px;">${currentTool?.status || '未开放'}</span>
              <div class="dev-focus-summary" style="max-width:320px; font-size:12px; color:var(--cloud-500);">${currentTool?.summary || ''}</div>
            </div>
          </div>

          ${stageMarkup}
        </section>
      </div>
      </section>
    </div>
  `

  bindEvents()
}

function executeMenuAction(action, description) {
  state.notice = description || ''
  if (action === 'open-devtools') {
    state.activePage = 'dev-tools-workbench'
    renderApp()
    return
  }
  if (action === 'open-main-menu') {
    state.activePage = 'main-menu'
    renderApp()
    return
  }
  if (action === 'open-settings') {
    state.activePage = 'settings'
    state.notice = ''
    refreshCurrentResolutionText().finally(() => {
      renderApp()
    })
    return
  }
  if (action === 'quit-game') {
    window.close()
    return
  }
  if (action === 'start-game') {
    state.activePage = 'game-hud'
    state.notice = '已进入游戏内界面。'
    renderApp()
    return
  }
  renderApp()
}

async function applyResolution() {
  const option = getSelectedResolutionOption()
  if (!option) {
    state.notice = '未找到分辨率选项。'
    renderApp()
    return
  }
  if (!window.electronAPI?.setWindowResolution) {
    state.notice = '当前环境不支持分辨率设置。'
    renderApp()
    return
  }
  try {
    const result = await window.electronAPI.setWindowResolution(option.width, option.height)
    if (result?.ok) {
      state.notice = `已应用 ${result.width} x ${result.height}`
    } else {
      state.notice = '应用失败，请重试。'
    }
    await refreshCurrentResolutionText()
  } catch (error) {
    state.notice = '应用失败，请检查窗口状态。'
  }
  renderApp()
}

function bindSettingsEvents() {
  const resolutionSelect = root.querySelector('[data-settings-field="resolution"]')
  if (resolutionSelect) {
    resolutionSelect.addEventListener('change', () => {
      state.selectedResolutionId = resolutionSelect.value
    })
  }

  root.querySelectorAll('[data-settings-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.settingsAction
      if (action === 'back-main') {
        executeMenuAction('open-main-menu', '返回首页')
        return
      }
      if (action === 'apply-resolution') {
        applyResolution()
      }
    })
  })
}

function bindMainMenuEvents() {
  root.querySelectorAll('[data-menu-action]').forEach((button) => {
    button.addEventListener('click', () => {
      executeMenuAction(button.dataset.menuAction, button.dataset.menuDescription)
    })
  })
}

function destroyPhaser() {
  if (state.phaserGame) {
    state.phaserGame.destroy(true)
    state.phaserGame = null
  }
}

function mountPhaserPreview() {
  destroyPhaser()
  const textTypes = getThemeLookup().textTypes
  const parent = document.getElementById('preview-surface')
  if (!parent) {
    return
  }
  const w = Math.max(parent.clientWidth, 420)
  const h = 460

  class PreviewScene extends Phaser.Scene {
    constructor() {
      super('PreviewScene')
    }

    create() {
      const sky = Phaser.Display.Color.HexStringToColor(themeConfig.theme.palette.sky[700]).color
      const cloud = Phaser.Display.Color.HexStringToColor(themeConfig.theme.palette.cloud[300]).color
      const black = Phaser.Display.Color.HexStringToColor(themeConfig.theme.palette.black[900]).color
      this.cameras.main.setBackgroundColor(black)

      this.add.rectangle(w / 2, h / 2, w, h, sky, 0.18)
      this.add.rectangle(w / 2, h - 58, w, 116, sky, 0.34)

      for (let i = 0; i < 5; i += 1) {
        const cloudBody = this.add.ellipse(90 + i * 140, 80 + (i % 2) * 24, 110, 44, cloud, 0.25)
        this.tweens.add({
          targets: cloudBody,
          x: cloudBody.x + 24,
          duration: 2800 + i * 260,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        })
      }

      const grid = this.add.graphics()
      grid.lineStyle(1, cloud, 0.18)
      for (let x = 0; x < w; x += 26) {
        grid.lineBetween(x, 0, x, h)
      }
      for (let y = 0; y < h; y += 26) {
        grid.lineBetween(0, y, w, y)
      }

      const hint = this.add.text(18, 16, 'Phaser 预览背景（工具预览默认）', {
        fontFamily: textTypes.body.fontFamily,
        fontSize: '16px',
        color: '#EAF4FF'
      })
      hint.setAlpha(0.9)
    }
  }

  state.phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: w,
    height: h,
    parent,
    transparent: false,
    scene: [PreviewScene]
  })
}

function mountSkeletonPreview() {
  destroyPhaser()
  const textTypes = getThemeLookup().textTypes
  const parent = document.getElementById('preview-surface')
  if (!parent) {
    return
  }

  parent.innerHTML = '<canvas id="skeleton-preview" width="900" height="460" style="width:100%;height:460px;display:block;"></canvas>'
  const canvas = document.getElementById('skeleton-preview')
  const ctx = canvas?.getContext('2d')
  if (!ctx) {
    return
  }

  const bg = themeConfig.theme.palette.black[900]
  const line = themeConfig.theme.palette.sky[300]
  const node = themeConfig.theme.palette.cloud[100]
  const body = themeConfig.theme.palette.cloud[500]
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const points = {
    head: [450, 84],
    neck: [450, 124],
    spine: [450, 178],
    pelvis: [450, 240],
    shoulderL: [402, 136],
    handL: [374, 206],
    shoulderR: [498, 136],
    handR: [526, 206],
    kneeL: [422, 318],
    footL: [410, 394],
    kneeR: [478, 318],
    footR: [490, 394]
  }
  const links = [
    ['head', 'neck'], ['neck', 'spine'], ['spine', 'pelvis'],
    ['neck', 'shoulderL'], ['shoulderL', 'handL'],
    ['neck', 'shoulderR'], ['shoulderR', 'handR'],
    ['pelvis', 'kneeL'], ['kneeL', 'footL'], ['pelvis', 'kneeR'], ['kneeR', 'footR']
  ]

  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(450, 102, 42, 46, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(412, 140, 76, 120)

  ctx.strokeStyle = line
  ctx.lineWidth = 3
  links.forEach(([from, to]) => {
    ctx.beginPath()
    ctx.moveTo(points[from][0], points[from][1])
    ctx.lineTo(points[to][0], points[to][1])
    ctx.stroke()
  })

  ctx.fillStyle = node
  Object.values(points).forEach(([x, y]) => {
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.fillStyle = '#EAF4FF'
  ctx.font = `20px ${textTypes.body.fontFamily}`
  ctx.fillText('骨架渲染预览（骨架/动作工具例外）', 24, 38)
}

function mountPreview() {
  const currentTool = getToolById(state.toolId)
  if (!currentTool) {
    destroyPhaser()
    return
  }
  if (currentTool.previewEngine === 'skeleton') {
    mountSkeletonPreview()
    return
  }
  mountPhaserPreview()
}

function bindEvents() {
  const backButton = root.querySelector('[data-menu-action="open-main-menu"]')
  if (backButton) {
    backButton.addEventListener('click', () => {
      executeMenuAction('open-main-menu', '返回首页')
    })
  }
  root.querySelectorAll('[data-category-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.categoryId = button.dataset.categoryId
      const category = getCategoryById(state.categoryId)
      state.toolId = category?.tools[0] || ''
      if (state.toolId === 'resource-browser') {
        await loadResourceIndex()
      }
      renderWorkbench()
    })
  })

  root.querySelectorAll('[data-tool-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.toolId = button.dataset.toolId
      if (state.toolId === 'resource-browser') {
        await loadResourceIndex()
      }
      renderWorkbench()
    })
  })

  // 资源管理器专属事件绑定
  root.querySelectorAll('[data-res-type]').forEach((button) => {
    button.addEventListener('click', () => {
      resourceBrowserState.typeKey = button.dataset.resType
      resourceBrowserState.selectedId = null
      renderWorkbench()
    })
  })

  root.querySelectorAll('[data-res-id]').forEach((cell) => {
    cell.addEventListener('click', () => {
      resourceBrowserState.selectedId = cell.dataset.resId
      renderWorkbench()
    })
  })
}

function renderApp() {
  if (state.activePage === 'main-menu') {
    destroyPhaser()
    renderMainMenu()
    return
  }
  if (state.activePage === 'settings') {
    destroyPhaser()
    renderSettingsPage()
    return
  }
  if (state.activePage === 'game-hud') {
    destroyPhaser()
    renderGameHud()
    return
  }
  renderWorkbench()
}

function boot() {
  if (!root) {
    return
  }
  applyStyles()
  renderApp()
}

if (uiIndex.ui.defaultTheme === themeConfig.theme.id) {
  boot()
}
