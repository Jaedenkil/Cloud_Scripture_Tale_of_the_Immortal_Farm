const path = require('path')
const fg = require('fast-glob')

const TYPE_BY_EXT = {
  '.png': 'texture',
  '.jpg': 'texture',
  '.jpeg': 'texture',
  '.webp': 'texture',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.json': 'config',
  '.yaml': 'config',
  '.yml': 'config',
  '.ttf': 'font',
  '.otf': 'font',
  '.woff': 'font',
  '.woff2': 'font',
  '.atlas': 'spine',
  '.skel': 'spine'
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function detectType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return TYPE_BY_EXT[ext] || 'unknown'
}

function deriveId(filePath) {
  const ext = path.extname(filePath)
  return path.basename(filePath, ext)
}

async function scanResources(rootDir, options = {}) {
  const cwd = rootDir
  const patterns = options.patterns || [
    'assets/source/**/*.*',
    'assets/runtime/**/*.*',
    'assets/packs/**/*.*'
  ]

  const entries = await fg(patterns, {
    cwd,
    dot: false,
    onlyFiles: true,
    unique: true
  })

  const items = entries.map((relPath) => {
    const normalized = toPosix(relPath)
    const type = detectType(normalized)
    const id = deriveId(normalized)
    const inRuntime = normalized.startsWith('assets/runtime/')
    const runtimePath = inRuntime ? normalized : ''

    return {
      id,
      type,
      subtype: '',
      sourcePath: normalized,
      runtimePath,
      packScope: normalized.startsWith('assets/packs/') ? 'pack' : 'default',
      logicalAliases: [],
      references: [],
      fallbackChain: [],
      validation: { ok: true },
      previewMeta: {},
      issues: []
    }
  })

  return {
    version: 'v1',
    generatedAt: new Date().toISOString(),
    items,
    issues: []
  }
}

module.exports = {
  scanResources,
  detectType,
  deriveId
}
