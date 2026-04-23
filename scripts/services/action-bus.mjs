import { BusCode } from "../utils/app-codes.mjs";
import { assert } from "../utils/flow-common.mjs";

/**
 * @typedef {object} ActionBusSnapshot
 * @property {number} channelCount
 * @property {number} listenerCount
 * @property {{channel:string, payload:any, timestamp:number}|null} lastEvent
 */

/**
 * ActionBus: lightweight publish/subscribe channel for UI actions.
 */
export class ActionBus {
  constructor() {
    this.listenersByChannel = new Map();
    this.lastEvent = null;
  }

  /**
   * Subscribe to a channel.
   *
   * @param {string} channel
   * @param {(payload:any)=>void} listener
   * @returns {() => void}
   */
  on(channel, listener) {
    const normalizedChannel = this.#normalizeChannel(channel);
    assert(typeof listener === "function", BusCode.INVALID_LISTENER, "listener must be a function", {
      channel: normalizedChannel
    });

    const listeners = this.listenersByChannel.get(normalizedChannel) || new Set();
    listeners.add(listener);
    this.listenersByChannel.set(normalizedChannel, listeners);

    return () => {
      this.off(normalizedChannel, listener);
    };
  }

  /**
   * Subscribe once to a channel.
   *
   * @param {string} channel
   * @param {(payload:any)=>void} listener
   * @returns {() => void}
   */
  once(channel, listener) {
    const normalizedChannel = this.#normalizeChannel(channel);
    assert(typeof listener === "function", BusCode.INVALID_LISTENER, "listener must be a function", {
      channel: normalizedChannel
    });

    const wrappedListener = (payload) => {
      this.off(normalizedChannel, wrappedListener);
      listener(payload);
    };

    return this.on(normalizedChannel, wrappedListener);
  }

  /**
   * Unsubscribe a listener from a channel.
   *
   * @param {string} channel
   * @param {(payload:any)=>void} listener
   * @returns {boolean}
   */
  off(channel, listener) {
    const normalizedChannel = this.#normalizeChannel(channel);
    const listeners = this.listenersByChannel.get(normalizedChannel);

    if (!listeners) {
      return false;
    }

    const removed = listeners.delete(listener);
    if (listeners.size === 0) {
      this.listenersByChannel.delete(normalizedChannel);
    }

    return removed;
  }

  /**
   * Emit payload to all listeners in a channel.
   *
   * @param {string} channel
   * @param {any} payload
   * @returns {number}
   */
  emit(channel, payload) {
    const normalizedChannel = this.#normalizeChannel(channel);
    const listeners = this.listenersByChannel.get(normalizedChannel);

    this.lastEvent = {
      channel: normalizedChannel,
      payload,
      timestamp: Date.now()
    };

    if (!listeners || listeners.size === 0) {
      return 0;
    }

    let calledCount = 0;
    for (const listener of listeners) {
      listener(payload);
      calledCount += 1;
    }

    return calledCount;
  }

  /**
   * Clear listeners by channel or clear all channels.
   *
   * @param {string} [channel]
   */
  clear(channel) {
    if (channel == null) {
      this.listenersByChannel.clear();
      return;
    }

    const normalizedChannel = this.#normalizeChannel(channel);
    this.listenersByChannel.delete(normalizedChannel);
  }

  /**
   * Return bus snapshot.
   *
   * @returns {ActionBusSnapshot}
   */
  getSnapshot() {
    let listenerCount = 0;
    for (const listeners of this.listenersByChannel.values()) {
      listenerCount += listeners.size;
    }

    return {
      channelCount: this.listenersByChannel.size,
      listenerCount,
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null
    };
  }

  #normalizeChannel(channel) {
    assert(typeof channel === "string", BusCode.INVALID_CHANNEL, "channel must be a string", {
      channel
    });

    const normalizedChannel = channel.trim();
    assert(normalizedChannel !== "", BusCode.INVALID_CHANNEL, "channel cannot be empty", {
      channel
    });

    return normalizedChannel;
  }
}
