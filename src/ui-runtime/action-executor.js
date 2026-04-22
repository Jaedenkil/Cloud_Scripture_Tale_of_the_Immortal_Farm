class ActionExecutor {
  constructor(options) {
    this.getState = options.getState
    this.patchState = options.patchState
    this.ruleEngine = options.ruleEngine
    this.handlers = options.handlers || {}
    this.onAfterExecute = options.onAfterExecute
  }

  createContext(extraContext = {}) {
    const capabilities = typeof this.handlers.getCapabilities === 'function'
      ? this.handlers.getCapabilities()
      : {}
    return {
      state: this.getState(),
      capabilities,
      ...extraContext
    }
  }

  isVisible(actionDefinition, extraContext = {}) {
    if (!actionDefinition || actionDefinition.visible === undefined) {
      return true
    }
    return Boolean(this.ruleEngine.evaluate(actionDefinition.visible, this.createContext(extraContext)))
  }

  isDisabled(actionDefinition, extraContext = {}) {
    if (!actionDefinition || actionDefinition.disabled === undefined) {
      return false
    }
    return Boolean(this.ruleEngine.evaluate(actionDefinition.disabled, this.createContext(extraContext)))
  }

  async execute(actionDefinition, extraContext = {}) {
    if (!actionDefinition) {
      return { ok: false, reason: 'missing-action-definition' }
    }

    const context = this.createContext(extraContext)

    if (this.isDisabled(actionDefinition, context)) {
      return { ok: false, reason: 'disabled' }
    }

    if (actionDefinition.precondition !== undefined) {
      const pass = Boolean(this.ruleEngine.evaluate(actionDefinition.precondition, context))
      if (!pass) {
        if (actionDefinition.blockedNotice) {
          this.patchState({ notice: actionDefinition.blockedNotice })
        }
        if (typeof this.onAfterExecute === 'function') {
          this.onAfterExecute({ ok: false, reason: 'precondition-failed' }, actionDefinition)
        }
        return { ok: false, reason: 'precondition-failed' }
      }
    }

    let shouldRender = true
    for (const effect of actionDefinition.effects || []) {
      const result = await this.applyEffect(effect, context)
      if (result && result.shouldRender === false) {
        shouldRender = false
      }
    }

    const outcome = { ok: true, shouldRender }
    if (typeof this.onAfterExecute === 'function') {
      this.onAfterExecute(outcome, actionDefinition)
    }
    return outcome
  }

  async applyEffect(effect, context) {
    if (!effect || typeof effect !== 'object') {
      return null
    }

    switch (effect.type) {
      case 'setState': {
        if (!effect.key) {
          return null
        }
        this.patchState({ [effect.key]: effect.value })
        return null
      }
      case 'callHandler': {
        const handler = this.handlers[effect.name]
        if (typeof handler === 'function') {
          await handler(effect, context)
        }
        return null
      }
      case 'closeWindow': {
        if (typeof this.handlers.closeWindow === 'function') {
          this.handlers.closeWindow()
        }
        return { shouldRender: false }
      }
      default:
        return null
    }
  }
}

export {
  ActionExecutor
}
