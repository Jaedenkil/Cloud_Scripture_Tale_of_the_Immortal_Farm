import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { buildResourceData } = require('../../apps/tools/resource-manager/resource-manager-service.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

async function main() {
  console.log('[ResourceManager] 开始构建资源索引...');
  try {
    const start = Date.now();
    const indexData = await buildResourceData(rootDir);
    
    const outDir = path.join(rootDir, 'storage/cache');
    await fs.mkdir(outDir, { recursive: true });
    
    const outPath = path.join(outDir, 'resource-index.report.json');
    await fs.writeFile(outPath, JSON.stringify(indexData, null, 2), 'utf8');
    
    const duration = Date.now() - start;
    console.log(`[ResourceManager] 构建完成！耗时: ${duration}ms`);
    console.log(`[ResourceManager] 报告已输出到: storage/cache/resource-index.report.json`);
    console.log(`[ResourceManager] 找到资源: ${indexData.items.length} 个, 校验问题: ${indexData.issues.length} 个`);
  } catch (error) {
    console.error('[ResourceManager] 构建失败:', error);
    process.exit(1);
  }
}

main();