import fs from 'node:fs'
import path from 'node:path'
import Ajv from 'ajv'
import { load } from 'js-yaml'
import { RESOURCE_BROWSER_VISUAL_STYLE_KEYS } from '../../src/ui-runtime/resource-browser-visual-style-keys.mjs'

const repoRoot = process.cwd()

function readYaml(relativePath) {
  const fullPath = path.join(repoRoot, relativePath)
  const text = fs.readFileSync(fullPath, 'utf8')
  return load(text)
}

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath)
  const text = fs.readFileSync(fullPath, 'utf8')
  return JSON.parse(text)
}

function getByPath(target, pathText) {
  return pathText
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), target)
}

function resolveStyleReference(value, styleRoot, unresolvedPaths) {
  if (typeof value !== 'string' || !value.startsWith('$style.')) {
    return value
  }
  const pathText = value.slice('$style.'.length)
  const resolved = getByPath(styleRoot, pathText)
  if (resolved === undefined) {
    unresolvedPaths.push(value)
  }
  return resolved
}

function resolveVisualStyles(visualStyles, styleRoot) {
  const unresolvedPaths = []
  const resolved = {}
  for (const [key, value] of Object.entries(visualStyles || {})) {
    resolved[key] = resolveStyleReference(value, styleRoot, unresolvedPaths)
  }
  return {
    resolved,
    unresolvedPaths
  }
}

function assertRuleFields(items, label) {
  const missing = []
  for (const item of items || []) {
    if (!Object.prototype.hasOwnProperty.call(item, 'visible')) {
      missing.push(`${label}:${item.id}:visible`)
    }
    if (!Object.prototype.hasOwnProperty.call(item, 'disabled')) {
      missing.push(`${label}:${item.id}:disabled`)
    }
  }
  return missing
}

const hud = readYaml('configs/ui/pages/game-hud.yaml')
const workbench = readYaml('configs/ui/pages/dev-tools-workbench.yaml')
const styleParams = readYaml('configs/ui/styles/style-params.yaml')

const failures = []
failures.push(...assertRuleFields(hud.actions, 'game-hud.action'))

const heroAction = workbench?.layout?.sections?.hero?.primaryAction
if (!heroAction || !Object.prototype.hasOwnProperty.call(heroAction, 'visible') || !Object.prototype.hasOwnProperty.call(heroAction, 'disabled')) {
  failures.push('dev-tools-workbench.hero.primaryAction:visible/disabled')
}

failures.push(...assertRuleFields(workbench.categories, 'workbench.category'))
failures.push(...assertRuleFields(workbench.tools, 'workbench.tool'))

const resourceBrowserTool = (workbench.tools || []).find((tool) => tool.id === 'resource-browser')
const controlRules = resourceBrowserTool?.resourceBrowserControls || {}
const visualStyles = controlRules.visualStyles || {}
const { resolved: resolvedVisualStyles, unresolvedPaths } = resolveVisualStyles(visualStyles, styleParams?.style || {})
const usedVisualStyleKeys = new Set(RESOURCE_BROWSER_VISUAL_STYLE_KEYS)
if (!controlRules.typeButton || !Object.prototype.hasOwnProperty.call(controlRules.typeButton, 'visible') || !Object.prototype.hasOwnProperty.call(controlRules.typeButton, 'disabled')) {
  failures.push('workbench.tool.resource-browser.control.typeButton:visible/disabled')
}
if (!controlRules.itemCell || !Object.prototype.hasOwnProperty.call(controlRules.itemCell, 'visible') || !Object.prototype.hasOwnProperty.call(controlRules.itemCell, 'disabled')) {
  failures.push('workbench.tool.resource-browser.control.itemCell:visible/disabled')
}
for (const key of Object.keys(visualStyles)) {
  if (!usedVisualStyleKeys.has(key)) {
    failures.push(`workbench.tool.resource-browser.control.visualStyles.unused:${key}`)
  }
}
if (unresolvedPaths.length > 0) {
  for (const unresolvedPath of unresolvedPaths) {
    failures.push(`workbench.tool.resource-browser.control.visualStyles.unresolved:${unresolvedPath}`)
  }
}

const visualStylesSchema = readJson('configs/schema/ui/resource-browser-visual-styles.schema.json')
visualStylesSchema.required = [...RESOURCE_BROWSER_VISUAL_STYLE_KEYS]
const ajv = new Ajv({ allErrors: true, strict: false })
const validateVisualStyles = ajv.compile(visualStylesSchema)
if (!validateVisualStyles(resolvedVisualStyles)) {
  for (const error of validateVisualStyles.errors || []) {
    const instancePath = error.instancePath || '/'
    const message = error.message || 'invalid'
    failures.push(`workbench.tool.resource-browser.control.visualStyles.schema:${instancePath}:${message}`)
  }
}

if (failures.length > 0) {
  console.error('UI rule regression check failed:')
  failures.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('UI rule regression check passed.')
