'use strict';

const { getJsxName } = require('../ast.cjs');

/**
 * Radix & shadcn Dialog & Modal Adapter
 * Supports DialogTitle, DialogDescription, AlertDialogTitle, AlertDialogDescription.
 */
const dialogAdapter = {
  id: 'dialog',

  detect: () => true,

  recognizeNode(node) {
    const name = getJsxName(node);
    if (name === 'DialogTitle' || name === 'AlertDialogTitle') {
      return { library: 'dialog', kind: 'text', role: 'dialog-title', tag: name };
    }
    if (name === 'DialogDescription' || name === 'AlertDialogDescription') {
      return { library: 'dialog', kind: 'text', role: 'dialog-desc', tag: name };
    }
    return null;
  },
};

module.exports = dialogAdapter;
