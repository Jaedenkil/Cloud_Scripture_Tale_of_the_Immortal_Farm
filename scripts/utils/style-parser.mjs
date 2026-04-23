import { YamlReadCode, YamlReadError, safeReadYamlFile } from "./read-yaml.mjs";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flattenComponents(components, output = []) {
  if (!Array.isArray(components)) {
    return output;
  }

  for (const component of components) {
    if (!isPlainObject(component)) {
      continue;
    }

    output.push(component);
    flattenComponents(component.children, output);
  }

  return output;
}

export class StyleParser {
  constructor(options = {}) {
    this.themePath = options.themePath;
    this.tokens = {};
    this.warnings = [];
  }

  async loadTheme(themePath = this.themePath) {
    if (!themePath) {
      throw new YamlReadError(YamlReadCode.INVALID_PATH, "themePath is required");
    }

    const result = await safeReadYamlFile(themePath, { expectedType: "object" });
    if (!result.ok) {
      throw new YamlReadError(result.code, result.message, result.details);
    }

    const { data } = result;

    if (!isPlainObject(data)) {
      throw new YamlReadError(YamlReadCode.TYPE_MISMATCH, "Theme root must be an object", {
        themePath
      });
    }

    this.tokens = isPlainObject(data.tokens) ? data.tokens : data;
    this.themePath = themePath;
    return this.tokens;
  }

  resolveValue(value, context = {}) {
    if (typeof value === "string" && value.startsWith("$")) {
      const tokenName = value.slice(1);
      if (Object.prototype.hasOwnProperty.call(this.tokens, tokenName)) {
        return this.tokens[tokenName];
      }

      this.warnings.push({
        code: "UNKNOWN_TOKEN",
        token: value,
        context
      });
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.resolveValue(item, { ...context, index }));
    }

    if (isPlainObject(value)) {
      const resolved = {};
      for (const [key, child] of Object.entries(value)) {
        resolved[key] = this.resolveValue(child, { ...context, key });
      }
      return resolved;
    }

    return value;
  }

  async parseSceneStyles(scenePath) {
    if (!this.themePath) {
      throw new YamlReadError(YamlReadCode.READ_FAILED, "Call loadTheme before parseSceneStyles", {
        scenePath
      });
    }

    const result = await safeReadYamlFile(scenePath, { expectedType: "object" });
    if (!result.ok) {
      throw new YamlReadError(result.code, result.message, result.details);
    }

    const { data } = result;

    if (!isPlainObject(data)) {
      throw new YamlReadError(YamlReadCode.TYPE_MISMATCH, "Scene root must be an object", {
        scenePath
      });
    }

    const components = flattenComponents(data.components);
    const styleEntries = [];

    for (const component of components) {
      const rawStyle = isPlainObject(component.style) ? component.style : {};
      const resolvedStyle = this.resolveValue(rawStyle, {
        scenePath,
        componentId: component.id ?? "unknown"
      });

      styleEntries.push({
        id: component.id ?? null,
        type: component.type ?? null,
        layer: component.layer ?? null,
        rawStyle,
        resolvedStyle
      });
    }

    return {
      page: data.page ?? null,
      tokenCount: Object.keys(this.tokens).length,
      styles: styleEntries,
      warnings: [...this.warnings]
    };
  }
}
