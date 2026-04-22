import Phaser from 'phaser'
import {
  UiConfigLoader
} from './page-registry.js'
import {
  RuleEngine
} from '../data-runtime/rule-evaluator/rule-engine.js'
import {
  ActionExecutor
} from '../ui-runtime/action-executor.js'
import {
  RESOURCE_BROWSER_VISUAL_STYLE_KEYS
} from '../ui-runtime/resource-browser-visual-style-keys.mjs'
import baseThemeCss from './styles/base-theme.css?raw'
import pageLayoutCssTemplate from './styles/page-layout.css?raw'

const uiConfigLoader = new UiConfigLoader({
  onUnresolvedStylePath(stylePath) {
    console.warn(`[ui-config] unresolved style reference: ${stylePath}`)
  }
})

const {
  getPageConfig,
  getActionDefinition,
  getResourceTypes,
  styleParamsConfig,
  themeConfig,
  uiIndex
} = uiConfigLoader.createRuntimeConfig()

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

function buildInlineStyle(styleMap = {}) {
  return Object.entries(styleMap)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}:${value};`)
    .join('')
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

const ruleEngine = new RuleEngine()

function getResolvedActionDefinition(actionId, localOverride = {}) {
  const baseDefinition = getActionDefinition(actionId) || {}
  return {
    id: actionId,
    ...baseDefinition,
    ...localOverride
  }
}

const actionExecutor = new ActionExecutor({
  getState: () => state,
  patchState: (patch) => {
    Object.assign(state, patch)
  },
  ruleEngine,
  handlers: {
    async refreshCurrentResolutionText() {
      await refreshCurrentResolutionText()
    },
    async applyResolution() {
      await applyResolution()
    },
    closeWindow() {
      window.close()
    },
    getCapabilities() {
      return {
        canSetResolution: Boolean(window.electronAPI?.setWindowResolution),
        canGetResolution: Boolean(window.electronAPI?.getWindowResolution)
      }
    }
  },
  onAfterExecute(result) {
    if (result?.shouldRender === false) {
      return
    }
    renderApp()
  }
})

async function executeAction(actionId, localOverride = {}) {
  const actionDefinition = getResolvedActionDefinition(actionId, localOverride)
  await actionExecutor.execute(actionDefinition)
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

const STYLE_TAG_IDS = {
  common: 'ui-style-common-params',
  base: 'ui-style-base-theme',
  page: 'ui-style-page-layout'
}

function upsertStyleTag(styleId, cssText) {
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }
  style.textContent = cssText
}

function getCommonStyleContext() {
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

  return {
    commonStyle,
    menuStyle,
    settingsStyle,
    workbenchStyle,
    gameHudStyle,
    appPaddingPx,
    panelGap,
    panelRadius,
    panelPadding,
    layoutColumns,
    mobileBreakpoint
  }
}

function loadCommonStyleParams() {
  const commonContext = getCommonStyleContext()
  const { appPaddingPx, panelGap, panelRadius, panelPadding } = commonContext
  const cssText = `
    @font-face {
      font-family: 'zpix';
      src: local('zpix');
      font-display: swap;
    }

    :root {
      --app-padding: ${appPaddingPx}px;
      --app-padding-double: ${appPaddingPx * 2}px;
      --panel-gap: ${panelGap};
      --panel-radius: ${panelRadius};
      --panel-padding: ${panelPadding};
    }

    #app {
      min-height: 100vh;
      box-sizing: border-box;
      padding: var(--app-padding);
      overflow: hidden;
    }
  `
  upsertStyleTag(STYLE_TAG_IDS.common, cssText)
  return commonContext
}

function loadBaseThemeStyles() {
  const { palette, textTypes } = getThemeLookup()
  const baseThemeStyle = styleParamsConfig?.style?.baseTheme || {}
  const cssText = `
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
      --base-body-background: ${baseThemeStyle.bodyBackground || 'radial-gradient(circle at 20% 0%, var(--black-100) 0%, var(--black-900) 58%)'};
      --base-body-color: ${baseThemeStyle.bodyColor || 'var(--cloud-300)'};
      --base-panel-background: ${baseThemeStyle.panelBackground || 'linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%)'};
      --base-panel-border: ${baseThemeStyle.panelBorder || '1px solid rgba(142, 163, 184, 0.35)'};
      --base-h1-margin: ${baseThemeStyle.h1Margin || '0'};
      --base-h1-font-size: ${toCssSize(baseThemeStyle.h1FontSize, '32px')};
      --base-h1-color: ${baseThemeStyle.h1Color || 'var(--cloud-100)'};
      --base-h2-margin: ${baseThemeStyle.h2Margin || '0'};
      --base-h2-font-size: ${toCssSize(baseThemeStyle.h2FontSize, '24px')};
      --base-h2-color: ${baseThemeStyle.h2Color || 'var(--sky-300)'};
      --base-h3-margin: ${baseThemeStyle.h3Margin || '0 0 8px'};
      --base-h3-font-size: ${toCssSize(baseThemeStyle.h3FontSize, '20px')};
      --base-h3-color: ${baseThemeStyle.h3Color || 'var(--sky-300)'};
    }
    ${baseThemeCss}
  `
  upsertStyleTag(STYLE_TAG_IDS.base, cssText)
}

function loadPageUiStyles(commonContext) {
  const {
    commonStyle,
    menuStyle,
    settingsStyle,
    workbenchStyle,
    gameHudStyle,
    appPaddingPx,
    layoutColumns,
    mobileBreakpoint
  } = commonContext
  const pageLayoutStyle = styleParamsConfig?.style?.pageLayout || {}
  const cssText = `
    :root {
      --layout-columns: ${layoutColumns};
      --menu-rows-desktop: ${menuStyle.rowsDesktop || '0.28fr 0.38fr 0.18fr 0.16fr'};
      --menu-rows-mobile: ${menuStyle.rowsMobile || '0.30fr 0.36fr 0.20fr 0.14fr'};
      --menu-zone-padding-y: ${toCssSize(menuStyle.zonePaddingY, '10px')};
      --menu-zone-padding-x: ${toCssSize(menuStyle.zonePaddingX, '16px')};
      --menu-title-size: ${toCssSize(menuStyle.titleSize, '56px')};
      --menu-tagline-size: ${toCssSize(menuStyle.taglineSize, '20px')};
      --menu-button-list-gap: ${toCssSize(commonStyle.menuButtonListGap, '10px')};
      --menu-button-list-width: ${toCssSize(menuStyle.buttonListWidth, '380px')};
      --menu-button-radius: ${toCssSize(commonStyle.menuButtonRadius, '10px')};
      --menu-button-padding-y: ${toCssSize(commonStyle.menuButtonPaddingY, '11px')};
      --menu-button-padding-x: ${toCssSize(commonStyle.menuButtonPaddingX, '14px')};
      --menu-button-font-size: ${toCssSize(commonStyle.menuButtonFontSize, '18px')};
      --menu-description-font-size: ${toCssSize(menuStyle.descriptionFontSize, '14px')};
      --menu-footer-note-font-size: ${toCssSize(menuStyle.footerNoteFontSize, '13px')};
      --settings-shell-max-width: ${toCssSize(settingsStyle.shellMaxWidth, '980px')};
      --settings-card-width: ${toCssSize(settingsStyle.cardWidth, '760px')};
      --settings-card-radius: ${toCssSize(settingsStyle.cardRadius, '14px')};
      --settings-card-padding: ${toCssSize(settingsStyle.cardPadding, '22px')};
      --settings-title-size: ${toCssSize(settingsStyle.titleSize, '40px')};
      --settings-section-margin-top: ${toCssSize(settingsStyle.sectionMarginTop, '18px')};
      --settings-section-padding: ${toCssSize(settingsStyle.sectionPadding, '14px')};
      --settings-section-radius: ${toCssSize(settingsStyle.sectionRadius, '10px')};
      --workbench-card-list-max-height: ${workbenchStyle.cardListMaxHeight || 'calc(100vh - 180px)'};
      --workbench-hero-min-height: ${toCssSize(workbenchStyle.heroMinHeight, '180px')};
      --workbench-category-gap: ${toCssSize(workbenchStyle.categoryGap, '10px')};
      --workbench-content-columns: ${workbenchStyle.contentColumns || 'minmax(340px, 0.92fr) minmax(420px, 1.08fr)'};
      --workbench-status-panel-padding: ${toCssSize(workbenchStyle.statusPanelPadding, '16px')};
      --gamehud-rows: ${gameHudStyle.rows || '0.2fr 0.58fr 0.22fr'};
      --gamehud-section-gap: ${toCssSize(gameHudStyle.sectionGap, '12px')};
      --gamehud-section-radius: ${toCssSize(gameHudStyle.sectionRadius, '12px')};
      --gamehud-strip-padding: ${toCssSize(gameHudStyle.stripPadding, '12px')};
      --gamehud-action-padding: ${toCssSize(gameHudStyle.actionPadding, '12px')};
      --gamehud-title-size: ${toCssSize(gameHudStyle.titleSize, '42px')};
      --gamehud-subtitle-size: ${toCssSize(gameHudStyle.subtitleSize, '20px')};
      --gamehud-desc-font-size: ${toCssSize(gameHudStyle.descFontSize, '15px')};
      --page-menu-zone-top-gap: ${toCssSize(pageLayoutStyle.menuZoneTopGap, '8px')};
      --page-menu-title-letter-spacing: ${toCssSize(pageLayoutStyle.menuTitleLetterSpacing, '3px')};
      --page-menu-button-transition-duration: ${pageLayoutStyle.menuButtonTransitionDuration || '0.12s'};
      --page-menu-button-hover-translate-y: ${toCssSize(pageLayoutStyle.menuButtonHoverTranslateY, '-1px')};
      --page-menu-button-hover-shadow: ${pageLayoutStyle.menuButtonHoverShadow || '0 0 0 1px rgba(120, 200, 255, 0.5) inset'};
      --page-menu-desc-min-height: ${toCssSize(pageLayoutStyle.menuDescMinHeight, '20px')};
      --page-settings-card-background: ${pageLayoutStyle.settingsCardBackground || 'linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%)'};
      --page-settings-card-border: ${pageLayoutStyle.settingsCardBorder || '1px solid rgba(142, 163, 184, 0.35)'};
      --page-settings-desc-margin-top: ${toCssSize(pageLayoutStyle.settingsDescMarginTop, '8px')};
      --page-settings-desc-font-size: ${toCssSize(pageLayoutStyle.settingsDescFontSize, '15px')};
      --page-settings-section-border: ${pageLayoutStyle.settingsSectionBorder || '1px dashed rgba(61, 168, 245, 0.6)'};
      --page-settings-section-background: ${pageLayoutStyle.settingsSectionBackground || 'rgba(9, 12, 16, 0.75)'};
      --page-settings-section-title-size: ${toCssSize(pageLayoutStyle.settingsSectionTitleSize, '22px')};
      --page-settings-field-margin-top: ${toCssSize(pageLayoutStyle.settingsFieldMarginTop, '12px')};
      --page-settings-label-font-size: ${toCssSize(pageLayoutStyle.settingsLabelFontSize, '16px')};
      --page-settings-label-margin-bottom: ${toCssSize(pageLayoutStyle.settingsLabelMarginBottom, '6px')};
      --page-settings-help-margin-top: ${toCssSize(pageLayoutStyle.settingsHelpMarginTop, '6px')};
      --page-settings-help-font-size: ${toCssSize(pageLayoutStyle.settingsHelpFontSize, '13px')};
      --page-settings-select-border: ${pageLayoutStyle.settingsSelectBorder || '1px solid rgba(120, 200, 255, 0.45)'};
      --page-settings-select-radius: ${toCssSize(pageLayoutStyle.settingsSelectRadius, '8px')};
      --page-settings-select-padding: ${toCssSize(pageLayoutStyle.settingsSelectPadding, '10px')};
      --page-settings-select-font-size: ${toCssSize(pageLayoutStyle.settingsSelectFontSize, '15px')};
      --page-settings-actions-margin-top: ${toCssSize(pageLayoutStyle.settingsActionsMarginTop, '14px')};
      --page-settings-actions-gap: ${toCssSize(pageLayoutStyle.settingsActionsGap, '10px')};
      --page-settings-status-margin-top: ${toCssSize(pageLayoutStyle.settingsStatusMarginTop, '12px')};
      --page-settings-status-font-size: ${toCssSize(pageLayoutStyle.settingsStatusFontSize, '14px')};
      --page-settings-status-min-height: ${toCssSize(pageLayoutStyle.settingsStatusMinHeight, '20px')};
      --page-inline-actions-margin-top: ${toCssSize(pageLayoutStyle.inlineActionsMarginTop, '8px')};
      --page-btn-inline-font-size: ${toCssSize(pageLayoutStyle.btnInlineFontSize, '13px')};
      --page-btn-inline-padding-y: ${toCssSize(pageLayoutStyle.btnInlinePaddingY, '6px')};
      --page-btn-inline-padding-x: ${toCssSize(pageLayoutStyle.btnInlinePaddingX, '10px')};
      --page-meta-font-size: ${toCssSize(pageLayoutStyle.metaFontSize, '14px')};
      --page-meta-margin-top: ${toCssSize(pageLayoutStyle.metaMarginTop, '6px')};
      --page-card-list-gap: ${toCssSize(pageLayoutStyle.cardListGap, '8px')};
      --page-card-list-margin-top: ${toCssSize(pageLayoutStyle.cardListMarginTop, '12px')};
      --page-card-list-padding-right: ${toCssSize(pageLayoutStyle.cardListPaddingRight, '4px')};
      --page-dev-shell-gap: ${toCssSize(pageLayoutStyle.devShellGap, '12px')};
      --page-dev-hero-gap: ${toCssSize(pageLayoutStyle.devHeroGap, '10px')};
      --page-dev-hero-padding-top: ${toCssSize(pageLayoutStyle.devHeroPaddingTop, '8px')};
      --page-dev-hero-padding-bottom: ${toCssSize(pageLayoutStyle.devHeroPaddingBottom, '6px')};
      --page-dev-hero-border-bottom: ${pageLayoutStyle.devHeroBorderBottom || '1px solid rgba(120, 200, 255, 0.25)'};
      --page-dev-hero-copy-gap: ${toCssSize(pageLayoutStyle.devHeroCopyGap, '6px')};
      --page-dev-hero-copy-max-width: ${toCssSize(pageLayoutStyle.devHeroCopyMaxWidth, '680px')};
      --page-dev-kicker-font-size: ${toCssSize(pageLayoutStyle.devKickerFontSize, '12px')};
      --page-dev-kicker-letter-spacing: ${toCssSize(pageLayoutStyle.devKickerLetterSpacing, '2px')};
      --page-dev-title-font-size: ${toCssSize(pageLayoutStyle.devTitleFontSize, '26px')};
      --page-dev-subtitle-max-width: ${toCssSize(pageLayoutStyle.devSubtitleMaxWidth, '620px')};
      --page-dev-subtitle-font-size: ${toCssSize(pageLayoutStyle.devSubtitleFontSize, '13px')};
      --page-dev-status-line-gap: ${toCssSize(pageLayoutStyle.devStatusLineGap, '8px')};
      --page-dev-status-line-font-size: ${toCssSize(pageLayoutStyle.devStatusLineFontSize, '12px')};
      --page-dev-status-chip-border: ${pageLayoutStyle.devStatusChipBorder || '1px solid rgba(120, 200, 255, 0.5)'};
      --page-dev-status-chip-padding-y: ${toCssSize(pageLayoutStyle.devStatusChipPaddingY, '2px')};
      --page-dev-status-chip-padding-x: ${toCssSize(pageLayoutStyle.devStatusChipPaddingX, '6px')};
      --page-dev-status-chip-background: ${pageLayoutStyle.devStatusChipBackground || 'rgba(9, 12, 16, 0.8)'};
      --page-dev-category-btn-padding-y: ${toCssSize(pageLayoutStyle.devCategoryBtnPaddingY, '10px')};
      --page-dev-category-btn-padding-x: ${toCssSize(pageLayoutStyle.devCategoryBtnPaddingX, '12px')};
      --page-dev-category-btn-transition-duration: ${pageLayoutStyle.devCategoryBtnTransitionDuration || '0.08s'};
      --page-dev-category-btn-bg: ${pageLayoutStyle.devCategoryBtnBackground || 'var(--black-300)'};
      --page-dev-category-btn-color: ${pageLayoutStyle.devCategoryBtnColor || 'var(--cloud-300)'};
      --page-dev-category-btn-border: ${pageLayoutStyle.devCategoryBtnBorder || '1px solid rgba(142, 163, 184, 0.45)'};
      --page-dev-category-btn-hover-translate: ${toCssSize(pageLayoutStyle.devCategoryBtnHoverTranslate, '-1px')};
      --page-dev-category-btn-hover-shadow: ${pageLayoutStyle.devCategoryBtnHoverShadow || '2px 2px 0 rgba(0, 0, 0, 0.95)'};
      --page-dev-category-name-font-size: ${toCssSize(pageLayoutStyle.devCategoryNameFontSize, '14px')};
      --page-dev-category-meta-margin-top: ${toCssSize(pageLayoutStyle.devCategoryMetaMarginTop, '4px')};
      --page-dev-category-meta-font-size: ${toCssSize(pageLayoutStyle.devCategoryMetaFontSize, '11px')};
      --page-dev-main-gap: ${toCssSize(pageLayoutStyle.devMainGap, '12px')};
      --page-dev-column-gap: ${toCssSize(pageLayoutStyle.devColumnGap, '8px')};
      --page-dev-tool-grid-gap: ${toCssSize(pageLayoutStyle.devToolGridGap, '8px')};
      --page-dev-tool-grid-padding-right: ${toCssSize(pageLayoutStyle.devToolGridPaddingRight, '4px')};
      --page-dev-sys-info-height: ${toCssSize(pageLayoutStyle.devSysInfoHeight, '100px')};
      --page-dev-sys-info-padding: ${toCssSize(pageLayoutStyle.devSysInfoPadding, '10px')};
      --page-dev-sys-info-bg: ${pageLayoutStyle.devSysInfoBackground || 'rgba(9, 12, 16, 0.8)'};
      --page-dev-sys-info-border: ${pageLayoutStyle.devSysInfoBorder || '1px solid rgba(142, 163, 184, 0.25)'};
      --page-dev-sys-info-radius: ${toCssSize(pageLayoutStyle.devSysInfoRadius, '4px')};
      --page-dev-sys-info-gap: ${toCssSize(pageLayoutStyle.devSysInfoGap, '6px')};
      --page-dev-sys-info-font-size: ${toCssSize(pageLayoutStyle.devSysInfoFontSize, '11px')};
      --page-dev-focus-gap: ${toCssSize(pageLayoutStyle.devFocusGap, '10px')};
      --page-dev-focus-border: ${pageLayoutStyle.devFocusBorder || '1px solid rgba(120, 200, 255, 0.4)'};
      --page-dev-focus-bg: ${pageLayoutStyle.devFocusBackground || 'linear-gradient(180deg, rgba(16, 20, 25, 0.96) 0%, rgba(5, 7, 10, 0.92) 100%)'};
      --page-dev-focus-head-gap: ${toCssSize(pageLayoutStyle.devFocusHeadGap, '16px')};
      --page-dev-focus-head-left-gap: ${toCssSize(pageLayoutStyle.devFocusHeadLeftGap, '10px')};
      --page-dev-focus-head-right-gap: ${toCssSize(pageLayoutStyle.devFocusHeadRightGap, '12px')};
      --page-dev-focus-title-font-size: ${toCssSize(pageLayoutStyle.devFocusTitleFontSize, '22px')};
      --page-dev-focus-kicker-font-size: ${toCssSize(pageLayoutStyle.devFocusKickerFontSize, '12px')};
      --page-dev-focus-summary-max-width: ${toCssSize(pageLayoutStyle.devFocusSummaryMaxWidth, '320px')};
      --page-dev-focus-summary-font-size: ${toCssSize(pageLayoutStyle.devFocusSummaryFontSize, '12px')};
      --page-dev-stage-gap: ${toCssSize(pageLayoutStyle.devStageGap, '12px')};
      --page-dev-stage-padding: ${toCssSize(pageLayoutStyle.devStagePadding, '14px')};
      --page-dev-stage-border: ${pageLayoutStyle.devStageBorder || '1px dashed rgba(61, 168, 245, 0.62)'};
      --page-dev-stage-bg-primary: ${pageLayoutStyle.devStageBackgroundPrimary || 'linear-gradient(180deg, rgba(9, 12, 16, 0.82) 0%, rgba(9, 12, 16, 0.92) 100%)'};
      --page-dev-stage-bg-grid: ${pageLayoutStyle.devStageBackgroundGrid || 'rgba(120, 200, 255, 0.08)'};
      --page-dev-stage-bg-grid-line-width: ${toCssSize(pageLayoutStyle.devStageBackgroundGridLineWidth, '1px')};
      --page-dev-stage-bg-grid-size: ${toCssSize(pageLayoutStyle.devStageBackgroundGridSize, '28px')};
      --page-dev-stage-copy-gap: ${toCssSize(pageLayoutStyle.devStageCopyGap, '10px')};
      --page-dev-stage-copy-max-width: ${toCssSize(pageLayoutStyle.devStageCopyMaxWidth, '420px')};
      --page-dev-stage-kicker-font-size: ${toCssSize(pageLayoutStyle.devStageKickerFontSize, '12px')};
      --page-dev-stage-kicker-letter-spacing: ${toCssSize(pageLayoutStyle.devStageKickerLetterSpacing, '1px')};
      --page-dev-stage-title-font-size: ${toCssSize(pageLayoutStyle.devStageTitleFontSize, '18px')};
      --page-dev-stage-desc-font-size: ${toCssSize(pageLayoutStyle.devStageDescFontSize, '13px')};
      --page-dev-stage-band-gap: ${toCssSize(pageLayoutStyle.devStageBandGap, '8px')};
      --page-dev-stage-cell-gap: ${toCssSize(pageLayoutStyle.devStageCellGap, '4px')};
      --page-dev-stage-cell-padding-y: ${toCssSize(pageLayoutStyle.devStageCellPaddingY, '8px')};
      --page-dev-stage-cell-padding-x: ${toCssSize(pageLayoutStyle.devStageCellPaddingX, '10px')};
      --page-dev-stage-cell-bg: ${pageLayoutStyle.devStageCellBackground || 'rgba(0, 0, 0, 0.26)'};
      --page-dev-stage-cell-border: ${pageLayoutStyle.devStageCellBorder || '1px solid rgba(142, 163, 184, 0.28)'};
      --page-dev-stage-label-font-size: ${toCssSize(pageLayoutStyle.devStageLabelFontSize, '11px')};
      --page-dev-stage-value-font-size: ${toCssSize(pageLayoutStyle.devStageValueFontSize, '13px')};
      --page-dev-focus-status-gap: ${toCssSize(pageLayoutStyle.devFocusStatusGap, '8px')};
      --page-dev-focus-status-item-padding-y: ${toCssSize(pageLayoutStyle.devFocusStatusItemPaddingY, '5px')};
      --page-dev-focus-status-item-padding-x: ${toCssSize(pageLayoutStyle.devFocusStatusItemPaddingX, '8px')};
      --page-dev-focus-status-item-font-size: ${toCssSize(pageLayoutStyle.devFocusStatusItemFontSize, '12px')};
      --page-dev-focus-status-item-border: ${pageLayoutStyle.devFocusStatusItemBorder || '1px solid rgba(142, 163, 184, 0.24)'};
      --page-dev-focus-status-item-bg: ${pageLayoutStyle.devFocusStatusItemBackground || 'rgba(9, 12, 16, 0.45)'};
      --page-dev-focus-status-strong-border-color: ${pageLayoutStyle.devFocusStatusStrongBorderColor || 'rgba(120, 200, 255, 0.45)'};
      --page-dev-scope-list-gap: ${toCssSize(pageLayoutStyle.devScopeListGap, '8px')};
      --page-dev-scope-item-gap: ${toCssSize(pageLayoutStyle.devScopeItemGap, '4px')};
      --page-dev-scope-item-padding-y: ${toCssSize(pageLayoutStyle.devScopeItemPaddingY, '8px')};
      --page-dev-scope-item-padding-x: ${toCssSize(pageLayoutStyle.devScopeItemPaddingX, '10px')};
      --page-dev-scope-item-border-left: ${pageLayoutStyle.devScopeItemBorderLeft || '2px solid var(--sky-500)'};
      --page-dev-scope-item-bg: ${pageLayoutStyle.devScopeItemBackground || 'rgba(9, 12, 16, 0.58)'};
      --page-dev-scope-title-font-size: ${toCssSize(pageLayoutStyle.devScopeTitleFontSize, '14px')};
      --page-dev-scope-meta-font-size: ${toCssSize(pageLayoutStyle.devScopeMetaFontSize, '11px')};
      --page-hud-panel-border: ${pageLayoutStyle.hudPanelBorder || '1px solid rgba(142, 163, 184, 0.35)'};
      --page-hud-panel-background: ${pageLayoutStyle.hudPanelBackground || 'linear-gradient(180deg, rgba(16, 20, 25, 0.95) 0%, rgba(5, 7, 10, 0.95) 100%)'};
      --page-hud-strip-gap: ${toCssSize(pageLayoutStyle.hudStripGap, '10px')};
      --page-hud-item-border: ${pageLayoutStyle.hudItemBorder || '1px dashed rgba(61, 168, 245, 0.6)'};
      --page-hud-item-radius: ${toCssSize(pageLayoutStyle.hudItemRadius, '8px')};
      --page-hud-item-padding-y: ${toCssSize(pageLayoutStyle.hudItemPaddingY, '8px')};
      --page-hud-item-padding-x: ${toCssSize(pageLayoutStyle.hudItemPaddingX, '10px')};
      --page-hud-item-label-font-size: ${toCssSize(pageLayoutStyle.hudItemLabelFontSize, '12px')};
      --page-hud-item-value-margin-top: ${toCssSize(pageLayoutStyle.hudItemValueMarginTop, '4px')};
      --page-hud-item-value-font-size: ${toCssSize(pageLayoutStyle.hudItemValueFontSize, '16px')};
      --page-hud-subtitle-margin-top: ${toCssSize(pageLayoutStyle.hudSubtitleMarginTop, '8px')};
      --page-hud-stage-padding: ${toCssSize(pageLayoutStyle.hudStagePadding, '16px')};
      --page-hud-desc-margin-top: ${toCssSize(pageLayoutStyle.hudDescMarginTop, '10px')};
      --page-hud-desc-max-width: ${toCssSize(pageLayoutStyle.hudDescMaxWidth, '760px')};
      --page-hud-actions-gap: ${toCssSize(pageLayoutStyle.hudActionsGap, '10px')};
      --page-btn-padding-y: ${toCssSize(pageLayoutStyle.btnPaddingY, '10px')};
      --page-btn-padding-x: ${toCssSize(pageLayoutStyle.btnPaddingX, '12px')};
      --page-btn-font-size: ${toCssSize(pageLayoutStyle.btnFontSize, '14px')};
      --page-btn-border: ${pageLayoutStyle.btnBorder || '1px solid rgba(142, 163, 184, 0.35)'};
      --page-btn-background: ${pageLayoutStyle.btnBackground || 'var(--black-300)'};
      --page-btn-color: ${pageLayoutStyle.btnColor || 'var(--cloud-300)'};
      --page-btn-transition-duration: ${pageLayoutStyle.btnTransitionDuration || '0.08s'};
      --page-btn-hover-translate: ${toCssSize(pageLayoutStyle.btnHoverTranslate, '-1px')};
      --page-btn-hover-shadow: ${pageLayoutStyle.btnHoverShadow || '2px 2px 0 rgba(0, 0, 0, 0.95)'};
      --page-btn-active-color: ${pageLayoutStyle.btnActiveColor || '#000'};
      --page-btn-active-background: ${pageLayoutStyle.btnActiveBackground || 'var(--sky-500)'};
      --page-btn-active-border-color: ${pageLayoutStyle.btnActiveBorderColor || 'var(--sky-300)'};
      --page-preview-shell-margin-top: ${toCssSize(pageLayoutStyle.previewShellMarginTop, '12px')};
      --page-preview-shell-border: ${pageLayoutStyle.previewShellBorder || '2px solid var(--sky-300)'};
      --page-preview-shell-radius: ${toCssSize(pageLayoutStyle.previewShellRadius, '10px')};
      --page-preview-shell-background: ${pageLayoutStyle.previewShellBackground || '#000'};
      --page-preview-shell-min-height: ${toCssSize(pageLayoutStyle.previewShellMinHeight, '460px')};
      --page-preview-surface-min-height: ${toCssSize(pageLayoutStyle.previewSurfaceMinHeight, '460px')};
      --page-card-item-border: ${pageLayoutStyle.cardItemBorder || '1px dashed rgba(61, 168, 245, 0.7)'};
      --page-card-item-radius: ${toCssSize(pageLayoutStyle.cardItemRadius, '10px')};
      --page-card-item-padding: ${toCssSize(pageLayoutStyle.cardItemPadding, '10px')};
      --page-card-item-bg: ${pageLayoutStyle.cardItemBackground || 'rgba(9, 12, 16, 0.9)'};
      --page-card-item-title-font-size: ${toCssSize(pageLayoutStyle.cardItemTitleFontSize, '16px')};
      --page-card-item-title-margin-bottom: ${toCssSize(pageLayoutStyle.cardItemTitleMarginBottom, '8px')};
      --page-chip-wrap-gap: ${toCssSize(pageLayoutStyle.chipWrapGap, '6px')};
      --page-chip-border: ${pageLayoutStyle.chipBorder || '1px solid rgba(198, 216, 234, 0.45)'};
      --page-chip-padding-y: ${toCssSize(pageLayoutStyle.chipPaddingY, '2px')};
      --page-chip-padding-x: ${toCssSize(pageLayoutStyle.chipPaddingX, '8px')};
      --page-chip-font-size: ${toCssSize(pageLayoutStyle.chipFontSize, '12px')};
      --page-chip-radius: ${toCssSize(pageLayoutStyle.chipRadius, '999px')};
      --page-chip-status-radius: ${toCssSize(pageLayoutStyle.chipStatusRadius, '12px')};
      --page-spec-preview-margin-top: ${toCssSize(pageLayoutStyle.specPreviewMarginTop, '14px')};
      --page-spec-preview-border-top: ${pageLayoutStyle.specPreviewBorderTop || '1px solid rgba(142, 163, 184, 0.3)'};
      --page-spec-preview-padding-top: ${toCssSize(pageLayoutStyle.specPreviewPaddingTop, '12px')};
      --page-spec-preview-gap: ${toCssSize(pageLayoutStyle.specPreviewGap, '10px')};
      --page-text-sample-border: ${pageLayoutStyle.textSampleBorder || '1px solid rgba(142, 163, 184, 0.35)'};
      --page-text-sample-radius: ${toCssSize(pageLayoutStyle.textSampleRadius, '8px')};
      --page-text-sample-padding: ${toCssSize(pageLayoutStyle.textSamplePadding, '8px')};
    }
    ${pageLayoutCssTemplate.replaceAll('__MOBILE_BREAKPOINT__', `${mobileBreakpoint}px`)}
  `
  upsertStyleTag(STYLE_TAG_IDS.page, cssText)
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
      const actionDefinition = getResolvedActionDefinition(button.action, button)
      if (!actionExecutor.isVisible(actionDefinition)) {
        return ''
      }
      const disabled = actionExecutor.isDisabled(actionDefinition)
      return `
        <button
          class="menu-btn"
          style="${getButtonStyle(button.type)}"
          data-menu-action="${button.action}"
          ${disabled ? 'disabled' : ''}
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
      const actionDefinition = getResolvedActionDefinition(action.id, action)
      if (!actionExecutor.isVisible(actionDefinition)) {
        return ''
      }
      const disabled = actionExecutor.isDisabled(actionDefinition)
      return `<button class="menu-btn" style="${getButtonStyle(action.type)}" data-hud-action="${action.id}" ${disabled ? 'disabled' : ''}>${action.text}</button>`
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
    button.addEventListener('click', async () => {
      const actionId = button.dataset.hudAction
      await executeAction(actionId)
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
      const actionDefinition = getResolvedActionDefinition(action.id, action)
      if (!actionExecutor.isVisible(actionDefinition)) {
        return ''
      }
      const disabled = actionExecutor.isDisabled(actionDefinition)
      return `<button class="menu-btn" style="${getButtonStyle(action.type)}" data-settings-action="${action.id}" ${disabled ? 'disabled' : ''}>${action.text}</button>`
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
      const sampleStyle = buildInlineStyle({
        'font-family': item.fontFamily,
        'font-size': `${item.size}px`,
        color: item.color
      })
      return `
        <div class="text-sample" style="${sampleStyle}">
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
      const buttonStyle = buildInlineStyle({
        background: item.background,
        color: item.textColor,
        border,
        cursor: 'default'
      })
      return `<button class="btn" style="${buttonStyle}">${item.id.toUpperCase()} 按钮</button>`
    })
    .join('')
}

function renderBorderSpecPreview() {
  return themeConfig.theme.borderTypes
    .map((item) => {
      const dash = item.dashed ? 'dashed' : 'solid'
      const previewStyle = buildInlineStyle({
        border: `${item.strokeWidth}px ${dash} ${item.strokeColor}`,
        background: item.background,
        'border-radius': '8px',
        padding: '8px',
        color: '#c6d8ea',
        'font-size': '13px'
      })
      return `<div style="${previewStyle}">${item.id} / ${item.strokeWidth}px</div>`
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

function buildResourceBrowserRuleContext(extra = {}) {
  return {
    state: {
      ...state,
      resourceBrowser: {
        ...resourceBrowserState
      }
    },
    ...extra
  }
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

function renderResourceBrowserStage(currentTool = {}) {
  const types = getResourceTypes()
  const controlRules = currentTool.resourceBrowserControls || {}
  const rawVisualStyles = controlRules.visualStyles || {}
  const visualStyles = Object.fromEntries(
    RESOURCE_BROWSER_VISUAL_STYLE_KEYS.map((key) => [key, rawVisualStyles[key]])
  )
  const typeButtonRule = controlRules.typeButton || {}
  const itemCellRule = controlRules.itemCell || {}
  const selectedBg = visualStyles.selectedBg
  const errorBg = visualStyles.errorBg
  const defaultBg = visualStyles.defaultBg
  const errorBorder = visualStyles.errorBorder
  const defaultBorder = visualStyles.defaultBorder
  const disabledOpacity = visualStyles.disabledOpacity
  const enabledOpacity = visualStyles.enabledOpacity
  const disabledCursor = visualStyles.disabledCursor
  const enabledCursor = visualStyles.enabledCursor
  const stageRootGap = visualStyles.stageRootGap
  const typeBarGap = visualStyles.typeBarGap
  const typeBarBorderBottom = visualStyles.typeBarBorderBottom
  const typeBarPaddingBottom = visualStyles.typeBarPaddingBottom
  const contentGridGap = visualStyles.contentGridGap
  const itemListGap = visualStyles.itemListGap
  const itemListPaddingRight = visualStyles.itemListPaddingRight
  const detailColumnBorderLeft = visualStyles.detailColumnBorderLeft
  const detailColumnPaddingLeft = visualStyles.detailColumnPaddingLeft
  const emptyListPadding = visualStyles.emptyListPadding
  const detailContainerGap = visualStyles.detailContainerGap
  const detailContainerPadding = visualStyles.detailContainerPadding
  const detailTitleColor = visualStyles.detailTitleColor
  const detailTitleFontFamily = visualStyles.detailTitleFontFamily
  const detailPathFontSize = visualStyles.detailPathFontSize
  const detailPathColor = visualStyles.detailPathColor
  const detailDividerBorderTop = visualStyles.detailDividerBorderTop
  const detailInfoCardBg = visualStyles.detailInfoCardBg
  const detailInfoCardPadding = visualStyles.detailInfoCardPadding
  const issueErrorColor = visualStyles.issueErrorColor
  const issueSuccessColor = visualStyles.issueSuccessColor
  const tileHintMarginTop = visualStyles.tileHintMarginTop
  const tileHintPadding = visualStyles.tileHintPadding
  const tileHintBg = visualStyles.tileHintBg
  const tileHintBorder = visualStyles.tileHintBorder
  const mediaPreviewMarginTop = visualStyles.mediaPreviewMarginTop
  const mediaPreviewBg = visualStyles.mediaPreviewBg
  const mediaPreviewBorder = visualStyles.mediaPreviewBorder
  const mediaPreviewRadius = visualStyles.mediaPreviewRadius
  const mediaPreviewPadding = visualStyles.mediaPreviewPadding
  const mediaPreviewTextureHeight = visualStyles.mediaPreviewTextureHeight
  const mediaPreviewAudioHeight = visualStyles.mediaPreviewAudioHeight
  const mediaImageMaxWidth = visualStyles.mediaImageMaxWidth
  const mediaImageMaxHeight = visualStyles.mediaImageMaxHeight
  const mediaImageObjectFit = visualStyles.mediaImageObjectFit
  const mediaImageRendering = visualStyles.mediaImageRendering
  const mediaAudioWidth = visualStyles.mediaAudioWidth
  const mediaAudioOutline = visualStyles.mediaAudioOutline
  const detailContainerStyle = buildInlineStyle({
    display: 'flex',
    'flex-direction': 'column',
    gap: detailContainerGap,
    padding: detailContainerPadding,
    'min-height': '0',
    'overflow-y': 'auto',
    'overflow-x': 'hidden'
  })
  const detailDividerStyle = buildInlineStyle({
    border: '0',
    'border-top': detailDividerBorderTop,
    width: '100%'
  })
  const detailInfoCardStyle = buildInlineStyle({
    background: detailInfoCardBg,
    padding: detailInfoCardPadding
  })
  const mediaPreviewContainerStyle = buildInlineStyle({
    'margin-top': mediaPreviewMarginTop,
    background: mediaPreviewBg,
    border: mediaPreviewBorder,
    'border-radius': mediaPreviewRadius,
    padding: mediaPreviewPadding,
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center'
  })
  const tileHintStyle = buildInlineStyle({
    'margin-top': tileHintMarginTop,
    padding: tileHintPadding,
    background: tileHintBg,
    border: tileHintBorder
  })
  const tileHintStyleText = `style="${tileHintStyle}"`
  const issueErrorStyle = buildInlineStyle({ color: issueErrorColor })
  const issueSuccessStyle = buildInlineStyle({ color: issueSuccessColor })
  const mediaImageStyle = buildInlineStyle({
    'max-width': mediaImageMaxWidth,
    'max-height': mediaImageMaxHeight,
    'object-fit': mediaImageObjectFit,
    'image-rendering': mediaImageRendering
  })
  const mediaAudioStyle = buildInlineStyle({
    width: mediaAudioWidth,
    height: mediaPreviewAudioHeight,
    outline: mediaAudioOutline
  })

  const typeButtons = types.map((t) => {
    if (!actionExecutor.isVisible(typeButtonRule, buildResourceBrowserRuleContext({ type: t }))) {
      return ''
    }
    const disabled = actionExecutor.isDisabled(typeButtonRule, buildResourceBrowserRuleContext({ type: t }))
    const active = resourceBrowserState.typeKey === t.key ? 'primary' : 'secondary'
    return `<button class="btn" style="${getButtonStyle(active)}" data-res-type="${t.key}" ${disabled ? 'disabled data-rule-disabled="1"' : ''}>${t.name}</button>`
  }).join('')

  const data = cachedResourceIndex || { items: [] }
  const items = data.items.filter(i => i.type === resourceBrowserState.typeKey)
  
  const selectedItem = items.find(i => i.id === resourceBrowserState.selectedId)

  const itemListHtml = items.map((item) => {
    if (!actionExecutor.isVisible(itemCellRule, buildResourceBrowserRuleContext({ item }))) {
      return ''
    }
    const disabled = actionExecutor.isDisabled(itemCellRule, buildResourceBrowserRuleContext({ item }))
    const isSelected = item.id === resourceBrowserState.selectedId
    const hasError = item.issues && item.issues.length > 0
    const bg = isSelected ? selectedBg : (hasError ? errorBg : defaultBg)
    const border = hasError ? errorBorder : defaultBorder
    const opacity = disabled ? disabledOpacity : enabledOpacity
    const cursor = disabled ? disabledCursor : enabledCursor
    const itemCellStyle = buildInlineStyle({
      background: bg,
      border,
      cursor,
      opacity
    })
    return `
      <div class="dev-stage-cell" style="${itemCellStyle}" data-res-id="${item.id}" ${disabled ? 'data-rule-disabled="1"' : ''}>
        <div class="dev-stage-value">${item.id}</div>
        <div class="dev-stage-label">${item.sourcePath}</div>
      </div>
    `
  }).join('') || `<div class="dev-stage-label" style="${buildInlineStyle({ padding: emptyListPadding })}">该分类下暂无资源</div>`

  let detailHtml = `<div class="dev-stage-label" style="padding: ${detailContainerPadding};">点击左侧资源查看详情</div>`
  if (selectedItem) {
    const refs = (selectedItem.references || []).map(r => `<div>${r}</div>`).join('') || '无引用'
    const fallbacks = (selectedItem.fallbackChain || []).map(f => `<div>[${f.level}] ${f.status === 'hit' ? '✅' : '❌'} ${f.path || ''}</div>`).join('')
    const issues = (selectedItem.issues || []).map(i => `<div style="${issueErrorStyle}">⚠️ ${i}</div>`).join('') || `<div style="${issueSuccessStyle}">✅ 校验通过</div>`
    
    // T15: 地块资源专项提示
    let tileHint = ''
    if (selectedItem.type === 'texture' && selectedItem.id && selectedItem.id.includes('_')) {
        const partsCheck = ['top', 'side-left', 'side-right', 'transition', 'variant']
        const hasParts = partsCheck.map(p => `[${selectedItem.id.includes(p) ? '✅' : ' '}] ${p}`).join(' ')
      tileHint = `<div ${tileHintStyleText}><strong>地块专项检测:</strong> <br/>${hasParts}</div>`
    }

    let mediaPreview = ''
    if (selectedItem.type === 'texture') {
      mediaPreview = `
        <div style="${mediaPreviewContainerStyle}${buildInlineStyle({ height: mediaPreviewTextureHeight, 'flex-shrink': '0' })}">
          <img src="/${selectedItem.runtimePath || selectedItem.sourcePath}" style="${mediaImageStyle}" />
        </div>
      `
    } else if (selectedItem.type === 'audio') {
      mediaPreview = `
        <div style="${mediaPreviewContainerStyle}">
          <audio controls src="/${selectedItem.runtimePath || selectedItem.sourcePath}" style="${mediaAudioStyle}"></audio>
        </div>
      `
    }

    detailHtml = `
      <div style="${detailContainerStyle}">
        <h4 style="${buildInlineStyle({ margin: '0', color: detailTitleColor, 'font-family': detailTitleFontFamily })}">${selectedItem.id}</h4>
        <div style="${buildInlineStyle({ 'font-size': detailPathFontSize, color: detailPathColor })}">${selectedItem.sourcePath}</div>
        ${mediaPreview}
        <hr style="${detailDividerStyle}" />
        
        <div><strong>校验结果:</strong><br/>${issues}</div>
        ${tileHint}
        
        <div><strong>引用追踪:</strong><br/>
          <div class="dev-stage-label" style="${detailInfoCardStyle}">${refs}</div>
        </div>
        
        <div><strong>回退链分析:</strong><br/>
          <div class="dev-stage-label" style="${detailInfoCardStyle}">${fallbacks}</div>
        </div>
      </div>
    `
  }

  return `
    <div class="dev-stage" data-template-id="resource-browser" style="${buildInlineStyle({ display: 'flex', 'flex-direction': 'column', flex: '1', 'min-height': '0', gap: stageRootGap })}">
      <div style="${buildInlineStyle({ 'flex-shrink': '0', display: 'flex', gap: typeBarGap, 'border-bottom': typeBarBorderBottom, 'padding-bottom': typeBarPaddingBottom, 'overflow-x': 'hidden' })}">
        ${typeButtons}
      </div>
      <div style="${buildInlineStyle({ flex: '1', display: 'grid', 'grid-template-columns': '1fr 1fr', gap: contentGridGap, 'min-height': '0', overflow: 'hidden' })}">
        <div style="${buildInlineStyle({ display: 'flex', 'flex-direction': 'column', gap: itemListGap, 'overflow-y': 'auto', 'overflow-x': 'hidden', 'padding-right': itemListPaddingRight })}">
          ${itemListHtml}
        </div>
        <div style="${buildInlineStyle({ 'border-left': detailColumnBorderLeft, 'padding-left': detailColumnPaddingLeft, 'overflow-y': 'auto', 'overflow-x': 'hidden', display: 'flex', 'flex-direction': 'column', 'min-height': '0' })}">
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
  const heroAction = heroSection.primaryAction || {}
  const categorySection = sections.category || {}
  const contentSection = sections.content || {}
  const categoryButtons = workbench.categories
    .map((item) => {
      if (!actionExecutor.isVisible(item, { category: item })) {
        return ''
      }
      const disabled = actionExecutor.isDisabled(item, { category: item })
      const buttonStyle = getButtonStyle(item.id === state.categoryId ? 'primary' : 'secondary')
      return `
        <button class="dev-category-btn" style="${buttonStyle}" data-category-id="${item.id}" ${disabled ? 'disabled' : ''}>
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
      if (!actionExecutor.isVisible(tool, { tool })) {
        return ''
      }
      const disabled = actionExecutor.isDisabled(tool, { tool })
      const buttonStyle = getButtonStyle(tool.id === state.toolId ? 'primary' : 'ghost')
      return `
        <button class="dev-tool-btn" style="${buttonStyle}" data-tool-id="${tool.id}" ${disabled ? 'disabled' : ''}>
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
    ? renderResourceBrowserStage(currentTool)
    : `
      <div class="dev-stage" data-template-id="default">
        <div style="${buildInlineStyle({ display: 'flex', 'justify-content': 'center', 'align-items': 'center', height: '100%', color: 'var(--cloud-700)' })}">
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
          ${actionExecutor.isVisible(heroAction) ? `<button class="btn btn-inline" data-menu-action="${heroAction.id || 'back-main'}" ${actionExecutor.isDisabled(heroAction) ? 'disabled' : ''}>${heroAction.text || '返回首页'}</button>` : ''}
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
          <div class="dev-focus-head">
            <div class="dev-focus-head-left">
              <h3 class="dev-focus-title">${currentTool?.name || '未选择'}</h3>
              <span class="dev-focus-kicker">${category?.name || '未选'}</span>
            </div>
            <div class="dev-focus-head-right">
              <span class="chip chip-status">${currentTool?.status || '未开放'}</span>
              <div class="dev-focus-summary">${currentTool?.summary || ''}</div>
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

async function executeMenuAction(actionId) {
  await executeAction(actionId)
}

async function applyResolution() {
  const option = getSelectedResolutionOption()
  if (!option) {
    state.notice = '未找到分辨率选项。'
    return
  }
  if (!window.electronAPI?.setWindowResolution) {
    state.notice = '当前环境不支持分辨率设置。'
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
}

function bindSettingsEvents() {
  const resolutionSelect = root.querySelector('[data-settings-field="resolution"]')
  if (resolutionSelect) {
    resolutionSelect.addEventListener('change', () => {
      state.selectedResolutionId = resolutionSelect.value
    })
  }

  root.querySelectorAll('[data-settings-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.settingsAction
      await executeAction(action)
    })
  })
}

function bindMainMenuEvents() {
  root.querySelectorAll('[data-menu-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      await executeMenuAction(button.dataset.menuAction)
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
  root.querySelectorAll('[data-menu-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      await executeMenuAction(button.dataset.menuAction)
    })
  })
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
      if (button.dataset.ruleDisabled === '1' || button.disabled) {
        return
      }
      resourceBrowserState.typeKey = button.dataset.resType
      resourceBrowserState.selectedId = null
      renderWorkbench()
    })
  })

  root.querySelectorAll('[data-res-id]').forEach((cell) => {
    cell.addEventListener('click', () => {
      if (cell.dataset.ruleDisabled === '1') {
        return
      }
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
  const commonStyleContext = loadCommonStyleParams()
  loadBaseThemeStyles()
  loadPageUiStyles(commonStyleContext)
  renderApp()
}

if (uiIndex.ui.defaultTheme === themeConfig.theme.id) {
  boot()
}
