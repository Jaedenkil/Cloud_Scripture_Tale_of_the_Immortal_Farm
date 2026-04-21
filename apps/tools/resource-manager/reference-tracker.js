const path = require('path')
const fg = require('fast-glob')
const fs = require('fs/promises')

function toPosix(p) {
  return p.split(path.sep).join('/')
}

async function collectReferenceSources(rootDir) {
  const paths = await fg([
    'configs/**/*.{yaml,yml,json}',
    'src/**/*.js'
  ], {
    cwd: rootDir,
    onlyFiles: true,
    unique: true
  })

  const entries = await Promise.all(paths.map(async (relPath) => {
    const absPath = path.join(rootDir, relPath)
    const content = await fs.readFile(absPath, 'utf8')
    return {
      path: toPosix(relPath),
      content
    }
  }))

  return entries
}

function findReferencesForItem(item, sources) {
  const keywordSet = new Set([item.id])
  for (const alias of item.logicalAliases || []) {
    keywordSet.add(alias)
  }

  const keywords = [...keywordSet].filter(Boolean)
  if (keywords.length === 0) {
    return []
  }

  const hits = []
  for (const source of sources) {
    const matched = keywords.some((keyword) => source.content.includes(keyword))
    if (matched) {
      hits.push(source.path)
    }
  }

  return hits
}

async function attachReferences(indexData, rootDir) {
  const sources = await collectReferenceSources(rootDir)

  for (const item of indexData.items || []) {
    item.references = findReferencesForItem(item, sources)
  }

  return indexData
}

module.exports = {
  attachReferences,
  collectReferenceSources,
  findReferencesForItem
}
