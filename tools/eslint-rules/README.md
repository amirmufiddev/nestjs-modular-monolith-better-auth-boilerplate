# Custom ESLint Rules

Digunakan dari flat config root: `eslint.config.mjs` — plugin `modular-monolith`, rule **`modular-monolith/no-cross-module-import`**.

Jalankan: `bun run lint`.

## no-cross-module-import

Enforces module API boundaries by preventing direct imports to `infrastructure/` or `domain/` layers from other modules.

### Rule Details

This rule prevents modules from directly accessing the internal implementation details of other modules. Cross-module communication must go through the public API layer (`modules/<name>/api/`).

### Examples

#### ❌ Incorrect (violations)

```typescript
// File: src/modules/order/infrastructure/order.repository.ts
// ❌ Cannot import from another module's domain layer
import { CustomerEntity } from '../../customer/domain/customer.entity';

// File: src/modules/order/application/order.service.ts  
// ❌ Cannot import from another module's infrastructure layer
import { CustomerRepository } from '../../customer/infrastructure/customer.repository';
```

#### ✅ Correct

```typescript
// File: src/modules/order/infrastructure/order.repository.ts
// ✅ Import from the same module's domain layer is allowed
import { OrderEntity } from '../domain/order.entity';

// File: src/modules/order/api/order.controller.ts
// ✅ API layer can orchestrate across modules
import { CustomerRepository } from '../../customer/infrastructure/customer.repository';

// File: src/modules/order/application/order.service.ts
// ✅ Import from another module's public API
import { CustomerService } from '../../customer/api/customer.service';
```

### Options

This rule has no configuration options.

### When Not To Use It

If you are not using a modular monolith architecture with strict module boundaries, this rule can be disabled.

### Implementation Details

The rule checks for imports matching these patterns:

1. **Relative imports**: `../../<module>/(infrastructure|domain)/...`
2. **Absolute imports**: `modules/<module>/(infrastructure|domain)/...`

The rule allows:

- Same-module imports (e.g., `order` module importing from `order/domain`)
- Imports from within the `api/` folder (API layer can orchestrate)
- Imports to any layer outside of `infrastructure/` or `domain/`

The rule reports a violation when:

- A file in one module tries to import from another module's `infrastructure/` or `domain/` layer
- Unless the importing file is in its own module's `api/` folder
