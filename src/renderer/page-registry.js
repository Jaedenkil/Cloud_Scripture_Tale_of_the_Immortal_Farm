import { load } from 'js-yaml'

import uiIndexRaw from '../../configs/ui/index.yaml?raw'
import themeRaw from '../../configs/ui/themes/theme.sky-cloud-black.yaml?raw'
import workbenchRaw from '../../configs/ui/pages/dev-tools-workbench.yaml?raw'
import mainMenuRaw from '../../configs/ui/pages/main-menu.yaml?raw'
import gameHudRaw from '../../configs/ui/pages/game-hud.yaml?raw'
import settingsRaw from '../../configs/ui/pages/settings.yaml?raw'
import styleParamsRaw from '../../configs/ui/styles/style-params.yaml?raw'
import actionDefinitionsRaw from '../../configs/ui/actions/action-definitions.yaml?raw'
import resourceCategoriesRaw from '../../configs/schema/common/resource-categories.yaml?raw'

function getValueByPath(source, path) {
  const parts = path.split('.').filter(Boolean)
  let current = source
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }
  return current
}

function parseYaml(rawSource, fallback = {}) {
  const parsed = load(rawSource)
  return parsed === undefined || parsed === null ? fallback : parsed
}

function resolveStyleParams(node, styleParamsConfig, onUnresolvedStylePath) {
  if (Array.isArray(node)) {
    return node.map((item) => resolveStyleParams(item, styleParamsConfig, onUnresolvedStylePath))
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, resolveStyleParams(value, styleParamsConfig, onUnresolvedStylePath)])
    )
  }
  if (typeof node === 'string' && node.startsWith('$style.')) {
    const resolved = getValueByPath(styleParamsConfig, node.slice(1))
    if (resolved === undefined && typeof onUnresolvedStylePath === 'function') {
      onUnresolvedStylePath(node)
    }
    return resolved === undefined ? node : resolved
  }
  return node
}

class UiConfigLoader {
  constructor(options = {}) {
    this.onUnresolvedStylePath = options.onUnresolvedStylePath
    this.styleParamsConfig = null
  }

  ensureStyleParamsLoaded() {
    if (!this.styleParamsConfig) {
      this.styleParamsConfig = parseYaml(styleParamsRaw, {})
    }
    return this.styleParamsConfig
  }

  loadStyleParamsConfig() {
    this.styleParamsConfig = parseYaml(styleParamsRaw, {})
    return this.styleParamsConfig
  }

  resolveWithStyleParams(node) {
    return resolveStyleParams(node, this.ensureStyleParamsLoaded(), this.onUnresolvedStylePath)
  }

  loadUiIndex() {
    return this.resolveWithStyleParams(parseYaml(uiIndexRaw, {}))
  }

  loadThemeConfig() {
    return this.resolveWithStyleParams(parseYaml(themeRaw, {}))
  }

  loadPageConfigs() {
    return {
      'main-menu': this.resolveWithStyleParams(parseYaml(mainMenuRaw, {})),
      'game-hud': this.resolveWithStyleParams(parseYaml(gameHudRaw, {})),
      settings: this.resolveWithStyleParams(parseYaml(settingsRaw, {})),
      'dev-tools-workbench': this.resolveWithStyleParams(parseYaml(workbenchRaw, {}))
    }
  }

  loadActionDefinitions() {
    return this.resolveWithStyleParams(parseYaml(actionDefinitionsRaw, {})) || {}
  }

  loadResourceCategories() {
    return this.resolveWithStyleParams(parseYaml(resourceCategoriesRaw, {})) || {}
  }

  createRuntimeConfig() {
    const styleParamsConfig = this.loadStyleParamsConfig()
    const uiIndex = this.loadUiIndex()
    const themeConfig = this.loadThemeConfig()
    const pageConfigs = this.loadPageConfigs()
    const actionDefinitions = this.loadActionDefinitions()
    const resourceCategories = this.loadResourceCategories()

    return {
      styleParamsConfig,
      themeConfig,
      uiIndex,
      pageConfigs,
      actionDefinitions,
      resourceCategories,
      getPageConfig(pageId) {
        return pageConfigs[pageId] || null
      },
      getActionDefinition(actionId) {
        return actionDefinitions.actions?.[actionId] || null
      },
      getResourceTypes() {
        return Array.isArray(resourceCategories.resource_types)
          ? resourceCategories.resource_types
          : []
      }
    }
  }
}

const uiConfigLoader = new UiConfigLoader()
const runtimeConfig = uiConfigLoader.createRuntimeConfig()
const {
  getPageConfig,
  getActionDefinition,
  getResourceTypes,
  pageConfigs,
  actionDefinitions,
  resourceCategories,
  styleParamsConfig,
  themeConfig,
  uiIndex
} = runtimeConfig

export {
  UiConfigLoader,
  getPageConfig,
  getActionDefinition,
  getResourceTypes,
  pageConfigs,
  actionDefinitions,
  resourceCategories,
  styleParamsConfig,
  themeConfig,
  uiConfigLoader,
  uiIndex
}
