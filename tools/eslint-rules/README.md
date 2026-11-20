# Custom ESLint Rules

Digunakan dari flat config root: `eslint.config.mjs` — plugin `modular-monolith`, rule **`modular-monolith/no-cross-module-import`**.

Jalankan: `bun run lint`.

## no-cross-module-import

Enforces module boundaries in the modular monolith by preventing direct cross-module imports into internal subfolders (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`, `presentation/`, `facade/`, `application/`).

### Rule Details

This rule prevents modules from directly accessing the internal implementation details of other modules. Cross-module communication must go through the module's public entrypoint (`modules/<name>` or `index.ts`) or `modules/<name>/interfaces`.

### Examples

#### ❌ Incorrect (violations)

```typescript
// File: src/modules/order/services/order.service.ts
// ❌ Cannot import directly from another module's repositories
import { CustomerRepository } from '../../customer/repositories/customer.repository';

// File: src/modules/order/controllers/order.controller.ts  
// ❌ Cannot import directly from another module's internal services
import { CustomerService } from '../../customer/services/customer.service';
```

#### ✅ Correct

```typescript
// File: src/modules/order/repositories/order.repository.ts
// ✅ Internal imports within the same module are allowed
import { IOrderRepository } from '../interfaces/order-repository.interface';

// File: src/modules/order/services/order.service.ts
// ✅ Import from another module's public entrypoint
import { CustomerService } from '@/modules/customer';
// ✅ Import abstraction / token from another module's interfaces
import { ICustomerRepository } from '@/modules/customer/interfaces';
```

### Options

This rule has no configuration options.

### When Not To Use It

If you are not using a modular monolith architecture with strict module boundaries, this rule can be disabled.

### Implementation Details

The rule checks for imports matching these patterns:

1. **Relative imports**: `../../<module>/(controllers|services|repositories|infrastructure|domain|presentation|facade|application)/...`
2. **Absolute imports**: `modules/<module>/(controllers|services|repositories|infrastructure|domain|presentation|facade|application)/...`

The rule allows:

- Same-module internal imports (e.g., `order` module importing from its own `repositories/` or `services/`)
- Imports from the root module entrypoint: `modules/<module>` or `modules/<module>/index`
- Imports from the interfaces folder: `modules/<module>/interfaces`

The rule reports a violation when:

- A file in one module tries to import directly from an internal subfolder of another module.
