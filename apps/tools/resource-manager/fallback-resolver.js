const path = require('path')
const fs = require('fs')

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function resolveFallbackChainForItem(item, rootDir) {
  const sourcePath = item.sourcePath || ''
  const runtimePath = item.runtimePath || ''

  const currentPath = runtimePath || sourcePath
  const defaultPath = currentPath.startsWith('assets/packs/')
    ? currentPath.replace(/^assets\/packs\/[a-zA-Z0-9_-]+\//, 'assets/runtime/')
    : currentPath
  const builtinPath = currentPath.startsWith('assets/')
    ? currentPath.replace(/^assets\/[a-zA-Z0-9_-]+\//, 'assets/runtime/')
    : currentPath

  const levels = [
    { level: 'current', path: currentPath },
    { level: 'default', path: defaultPath },
    { level: 'builtin', path: builtinPath }
  ]

  return levels.map((entry) => {
    const fullPath = path.join(rootDir, entry.path)
    const exists = entry.path ? fs.existsSync(fullPath) : false
    return {
      level: entry.level,
      path: toPosix(entry.path),
      status: exists ? 'hit' : 'missing'
    }
  })
}

function attachFallbackChains(indexData, rootDir) {
  for (const item of indexData.items || []) {
    item.fallbackChain = resolveFallbackChainForItem(item, rootDir)
  }
  return indexData
}

module.exports = {
  attachFallbackChains,
  resolveFallbackChainForItem
}
