import path from 'node:path';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow cross-module imports to internal module subfolders',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      noCrossModuleImport:
        "Cross-module import violation: '{{importPath}}'. Modul lain hanya boleh diimpor via public entrypoint 'modules/<name>' (index.ts) atau 'modules/<name>/interfaces'. Dilarang mengimpor langsung subfolder internal (controllers/services/repositories/infrastructure/domain).",
    },
  },
  create(context) {
    const rawFile = context.getFilename ? context.getFilename() : context.filename;
    const currentFile = (rawFile || '').replace(/\\/g, '/');

    const currentModuleMatch = currentFile.match(/(?:^|\/)modules\/([^/]+)\//);
    if (!currentModuleMatch) return {};

    const currentModule = currentModuleMatch[1];

    return {
      ImportDeclaration(node) {
        const importPath = node.source?.value;
        if (typeof importPath !== 'string') return;

        let targetModule;
        let isInternalSubfolder = false;

        const internalFoldersRegex = /\/(controllers|services|repositories|infrastructure|domain|presentation|facade|application)(?:\/|$)/;

        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(rawFile), importPath).replace(/\\/g, '/');
          const targetModuleMatch = resolvedPath.match(/(?:^|\/)modules\/([^/]+)\//);
          if (!targetModuleMatch) return;

          targetModule = targetModuleMatch[1];
          isInternalSubfolder = internalFoldersRegex.test(resolvedPath);
        } else if (importPath.includes('modules/')) {
          const targetModuleMatch = importPath.match(/(?:^|\/)modules\/([^/]+)\//);
          if (!targetModuleMatch) return;

          targetModule = targetModuleMatch[1];
          isInternalSubfolder = internalFoldersRegex.test(importPath);
        } else {
          return;
        }

        // Allow internal imports within the same module
        if (targetModule === currentModule) return;

        if (isInternalSubfolder) {
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
