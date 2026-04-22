function getValueByPath(source, path) {
  if (!path || typeof path !== 'string') {
    return undefined
  }
  return path.split('.').filter(Boolean).reduce((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    return current[part]
  }, source)
}

class RuleEngine {
  evaluate(rule, context = {}) {
    if (rule === undefined || rule === null) {
      return true
    }
    if (typeof rule === 'boolean' || typeof rule === 'number') {
      return rule
    }
    if (typeof rule === 'string') {
      return rule
    }
    if (Array.isArray(rule)) {
      return rule.every((item) => Boolean(this.evaluate(item, context)))
    }

    if (rule.var !== undefined) {
      return getValueByPath(context, rule.var)
    }
    if (rule.exists !== undefined) {
      return getValueByPath(context, rule.exists) !== undefined
    }
    if (rule.not !== undefined) {
      return !Boolean(this.evaluate(rule.not, context))
    }
    if (Array.isArray(rule.and)) {
      return rule.and.every((item) => Boolean(this.evaluate(item, context)))
    }
    if (Array.isArray(rule.or)) {
      return rule.or.some((item) => Boolean(this.evaluate(item, context)))
    }
    if (Array.isArray(rule.eq) && rule.eq.length >= 2) {
      return this.resolveValue(rule.eq[0], context) === this.resolveValue(rule.eq[1], context)
    }
    if (Array.isArray(rule.ne) && rule.ne.length >= 2) {
      return this.resolveValue(rule.ne[0], context) !== this.resolveValue(rule.ne[1], context)
    }

    return Boolean(rule)
  }

  resolveValue(value, context = {}) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.var !== undefined) {
        return getValueByPath(context, value.var)
      }
      return this.evaluate(value, context)
    }
    return value
  }
}

export {
  RuleEngine
}
