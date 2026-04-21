const path = require('path')

function validateGenericName(name) {
  const re = /^[a-z0-9][a-z0-9_-]*$/
  return re.test(name)
}

function parseTileName(name) {
  const re = /^(?<type>[a-z0-9]+)_(?<part>top|side-left|side-right|transition)(?:_(?<transition>[a-z0-9]+))?(?:_(?<direction>n|e|s|w|ne|se|sw|nw))?(?:_(?<variant>v[0-9]+))?$/
  return name.match(re)
}

function validateTileItems(items) {
  const groups = new Map()

  for (const item of items) {
    if (item.type !== 'texture') {
      continue
    }
    const base = path.basename(item.sourcePath, path.extname(item.sourcePath))
    const matched = parseTileName(base)
    if (!matched || !matched.groups) {
      continue
    }

    const tileType = matched.groups.type
    const part = matched.groups.part
    if (!groups.has(tileType)) {
      groups.set(tileType, new Set())
    }
    groups.get(tileType).add(part)
  }

  const issues = []
  const requiredParts = ['top', 'side-left', 'side-right']

  for (const [tileType, partSet] of groups.entries()) {
    for (const required of requiredParts) {
      if (!partSet.has(required)) {
        issues.push({
          code: 'tile.missing-part',
          message: `地块 ${tileType} 缺少部位 ${required}`,
          path: `tile:${tileType}`
        })
      }
    }
  }

  return issues
}

function validateResourceIndex(indexData) {
  const issues = [...(indexData.issues || [])]

  for (const item of indexData.items || []) {
    const base = path.basename(item.sourcePath, path.extname(item.sourcePath))
    if (!validateGenericName(base)) {
      item.validation = { ok: false, ruleId: 'generic' }
      item.issues.push('命名不符合通用规则')
      issues.push({
        code: 'name.invalid',
        message: `资源命名不合法: ${base}`,
        path: item.sourcePath
      })
    }
  }

  issues.push(...validateTileItems(indexData.items || []))

  return {
    ...indexData,
    issues
  }
}

module.exports = {
  validateResourceIndex,
  validateGenericName,
  parseTileName,
  validateTileItems
}
