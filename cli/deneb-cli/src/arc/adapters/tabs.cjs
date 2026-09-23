'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Radix & shadcn Tabs Adapter
 * Supports Tabs, TabsList, TabsTrigger, TabsContent.
 */
const tabsAdapter = {
  id: 'tabs',

  detect: () => true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'Tabs') {
      return { library: 'tabs', kind: 'structure', role: 'tabs-container', tag: name };
    }
    if (name === 'TabsTrigger') {
      return { library: 'tabs', kind: 'action', role: 'tab-button', tag: name };
    }
    if (name === 'TabsContent') {
      return { library: 'tabs', kind: 'structure', role: 'tab-panel', tag: name };
    }
    return null;
  },
};

module.exports = tabsAdapter;
