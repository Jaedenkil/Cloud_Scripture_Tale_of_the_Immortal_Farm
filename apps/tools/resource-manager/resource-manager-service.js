const { scanResources } = require('./resource-indexer')
const { validateResourceIndex } = require('./resource-validator')
const { attachReferences } = require('./reference-tracker')
const { attachFallbackChains } = require('./fallback-resolver')

async function buildResourceData(rootDir, options = {}) {
  let indexData = await scanResources(rootDir, options)
  indexData = validateResourceIndex(indexData)
  indexData = await attachReferences(indexData, rootDir)
  indexData = attachFallbackChains(indexData, rootDir)
  return indexData
}

function getList(indexData, filters = {}) {
  const type = filters.type || ''
  const keyword = (filters.keyword || '').trim().toLowerCase()

  return (indexData.items || []).filter((item) => {
    if (type && item.type !== type) {
      return false
    }
    if (!keyword) {
      return true
    }
    const haystack = `${item.id} ${item.sourcePath} ${(item.references || []).join(' ')}`.toLowerCase()
    return haystack.includes(keyword)
  })
}

function getDetail(indexData, id) {
  return (indexData.items || []).find((item) => item.id === id) || null
}

function getIssues(indexData) {
  return indexData.issues || []
}

module.exports = {
  buildResourceData,
  getList,
  getDetail,
  getIssues
}
