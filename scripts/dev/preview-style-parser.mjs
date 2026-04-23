import path from "node:path";
import { fileURLToPath } from "node:url";
import { StyleParser } from "../utils/style-parser.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

const themePath = path.join(root, "scenes", "theme.yaml");
const scenePath = path.join(root, "scenes", "panel", "home.yaml");

const parser = new StyleParser();
await parser.loadTheme(themePath);
const result = await parser.parseSceneStyles(scenePath);

console.log("=== Style Parser Preview ===");
console.log(JSON.stringify(result, null, 2));
