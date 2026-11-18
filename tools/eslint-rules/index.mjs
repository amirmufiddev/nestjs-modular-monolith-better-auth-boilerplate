/**
 * Custom ESLint rules for NestJS modular monolith boilerplate
 * 
 * This file exports all custom rules to be registered in eslint.config.mjs
 */

import noCrossModuleImport from './no-cross-module-import.mjs';

export default {
  rules: {
    'no-cross-module-import': noCrossModuleImport,
  },
};
