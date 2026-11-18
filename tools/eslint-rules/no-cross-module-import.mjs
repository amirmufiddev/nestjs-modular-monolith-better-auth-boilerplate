/**
 * ESLint custom rule: no-cross-module-import
 * 
 * Prevents cross-module imports outside the public api/ folder.
 * Modules can only consume other modules via 'modules/<name>/api/'.
 * Direct imports to infrastructure/ or domain/ are forbidden.
 */

import path from 'node:path';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow cross-module imports outside the public api/ folder',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      noCrossModuleImport:
        "Cross-module import detected: '{{importPath}}'. Modul hanya boleh consume modul lain via 'modules/<name>/api/'. Import langsung ke infrastructure/domain terlarang.",
    },
  },
  create(context) {
    const rawFile = context.getFilename ? context.getFilename() : context.filename;
    const currentFile = (rawFile || '').replace(/\\/g, '/');

    // Extract current module from file path
    const currentModuleMatch = currentFile.match(/(?:^|\/)modules\/([^/]+)\//);
    if (!currentModuleMatch) return {};

    const currentModule = currentModuleMatch[1];

    // Allow if current file is in api/ folder (api layer can import from other modules)
    // This is intentionally permissive - api/ needs to orchestrate across modules
    if (currentFile.includes(`/modules/${currentModule}/api/`)) return {};

    return {
      ImportDeclaration(node) {
        const importPath = node.source?.value;
        if (typeof importPath !== 'string') return;

        let targetModule;
        let isForbiddenLayer = false;

        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(rawFile), importPath).replace(/\\/g, '/');
          const targetModuleMatch = resolvedPath.match(/(?:^|\/)modules\/([^/]+)\//);
          if (!targetModuleMatch) return;

          targetModule = targetModuleMatch[1];
          isForbiddenLayer = /\/(infrastructure|domain)(?:\/|$)/.test(resolvedPath);
        } else if (importPath.includes('modules/')) {
          const targetModuleMatch = importPath.match(/(?:^|\/)modules\/([^/]+)\//);
          if (!targetModuleMatch) return;

          targetModule = targetModuleMatch[1];
          isForbiddenLayer = /\/(infrastructure|domain)(?:\/|$)/.test(importPath);
        } else {
          return;
        }

        // Allow imports within the same module
        if (targetModule === currentModule) return;

        // Report violation: cross-module import to infrastructure/domain from non-api layer
        if (isForbiddenLayer) {
          context.report({
            node,
            messageId: 'noCrossModuleImport',
            data: { importPath },
          });
        }
      },
    };
  },
};

export default rule;
