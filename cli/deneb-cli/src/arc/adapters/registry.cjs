'use strict';

const pictureSourceAdapter = require('./picture-source.cjs');
const swiperAdapter = require('./swiper.cjs');
const emblaAdapter = require('./embla.cjs');
const slickAdapter = require('./slick.cjs');
const accordionAdapter = require('./accordion.cjs');
const tabsAdapter = require('./tabs.cjs');
const dialogAdapter = require('./dialog.cjs');
const galleryAdapter = require('./gallery.cjs');
const {
  nextjsAdapter,
  denebAdapter,
  shadcnAdapter,
  herouiAdapter,
  framerMotionAdapter,
  reactBitsAdapter,
  radixAdapter,
} = require('./ui-frameworks.cjs');

/**
 * Adapter Registry for Deneb ARC v2
 * Manages detection, semantic recognition, and transformation across ecosystem libraries.
 */
class AdapterRegistry {
  constructor() {
    this._adapters = new Map();
  }

  /**
   * Registers a new or custom adapter.
   */
  register(adapter) {
    if (!adapter || !adapter.id) {
      throw new Error('Adapter must provide a unique "id" string');
    }
    this._adapters.set(adapter.id, adapter);
  }

  /**
   * Retrieves an adapter by its ID.
   */
  get(id) {
    return this._adapters.get(id);
  }

  /**
   * Returns all registered adapters.
   */
  getAll() {
    return Array.from(this._adapters.values());
  }

  /**
   * Returns adapters active for the given project profile.
   */
  getActive(profile = {}) {
    return this.getAll().filter((adapter) => {
      try {
        return typeof adapter.detect === 'function' ? adapter.detect(profile) : true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Dispatches node recognition through active adapters.
   */
  recognizeNode(node, ctx, adaptersList) {
    const active = adaptersList || this.getActive(ctx?.profile);
    for (const adapter of active) {
      if (!adapter.recognizeNode) continue;
      const result = adapter.recognizeNode(node, ctx);
      if (result) {
        return { ...result, adapterId: adapter.id };
      }
    }
    return null;
  }

  /**
   * Dispatches action resolution through active adapters.
   */
  resolveAction(node, adaptersList) {
    const active = adaptersList || this.getAll();
    for (const adapter of active) {
      if (!adapter.resolveAction) continue;
      const result = adapter.resolveAction(node);
      if (result) return result;
    }
    return null;
  }
}

// Global default registry
const defaultRegistry = new AdapterRegistry();

// Register all standard built-in adapters
const BUILTIN_ADAPTERS = [
  nextjsAdapter,
  denebAdapter,
  shadcnAdapter,
  herouiAdapter,
  framerMotionAdapter,
  reactBitsAdapter,
  radixAdapter,
  pictureSourceAdapter,
  swiperAdapter,
  emblaAdapter,
  slickAdapter,
  accordionAdapter,
  tabsAdapter,
  dialogAdapter,
  galleryAdapter,
];

for (const adapter of BUILTIN_ADAPTERS) {
  defaultRegistry.register(adapter);
}

function registerAdapter(adapter) {
  defaultRegistry.register(adapter);
}

function getAdapter(id) {
  return defaultRegistry.get(id);
}

function getAllAdapters() {
  return defaultRegistry.getAll();
}

function activeAdapters(profile) {
  return defaultRegistry.getActive(profile);
}

function recognizeWithAdapters(node, ctx, adapters) {
  return defaultRegistry.recognizeNode(node, ctx, adapters);
}

function resolveActionWithAdapters(node, adapters) {
  return defaultRegistry.resolveAction(node, adapters);
}

module.exports = {
  AdapterRegistry,
  defaultRegistry,
  BUILTIN_ADAPTERS,
  registerAdapter,
  getAdapter,
  getAllAdapters,
  activeAdapters,
  recognizeWithAdapters,
  resolveActionWithAdapters,
};
