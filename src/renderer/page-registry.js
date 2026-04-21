import { load } from 'js-yaml'

import uiIndexRaw from '../../configs/ui/index.yaml?raw'
import themeRaw from '../../configs/ui/themes/theme.sky-cloud-black.yaml?raw'
import workbenchRaw from '../../configs/ui/pages/dev-tools-workbench.yaml?raw'
import mainMenuRaw from '../../configs/ui/pages/main-menu.yaml?raw'
import gameHudRaw from '../../configs/ui/pages/game-hud.yaml?raw'
import settingsRaw from '../../configs/ui/pages/settings.yaml?raw'
import styleParamsRaw from '../../configs/ui/styles/style-params.yaml?raw'
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

const styleParamsConfig = load(styleParamsRaw) || {}

function resolveStyleParams(node) {
  if (Array.isArray(node)) {
    return node.map((item) => resolveStyleParams(item))
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolveStyleParams(value)]))
  }
  if (typeof node === 'string' && node.startsWith('$style.')) {
    const resolved = getValueByPath(styleParamsConfig, node.slice(1))
    return resolved === undefined ? node : resolved
  }
  return node
}

const uiIndex = resolveStyleParams(load(uiIndexRaw))
const themeConfig = resolveStyleParams(load(themeRaw))
const pageConfigs = {
  'main-menu': resolveStyleParams(load(mainMenuRaw)),
  'game-hud': resolveStyleParams(load(gameHudRaw)),
  settings: resolveStyleParams(load(settingsRaw)),
  'dev-tools-workbench': resolveStyleParams(load(workbenchRaw))
}
const resourceCategories = resolveStyleParams(load(resourceCategoriesRaw)) || {}

function getPageConfig(pageId) {
  return pageConfigs[pageId] || null
}

function getResourceTypes() {
  return Array.isArray(resourceCategories.resource_types)
    ? resourceCategories.resource_types
    : []
}

export {
  getPageConfig,
  getResourceTypes,
  pageConfigs,
  resourceCategories,
  styleParamsConfig,
  themeConfig,
  uiIndex
}
