# Anti-Patterns Reference

Katalog code smell dan solusi untuk clean code, modular monolith, performance, security, error handling, dan testing.

## Foundation Layer Status (P1)

Foundation Layer boilerplate sudah tersedia — lihat `src/shared/README.md` untuk: `RlsContext`/`RlsInterceptor`, `SseService`, `FcmAdapter`, event bus `@nestjs/event-emitter`, dan registry `DomainEventMap`. Anti-pattern di bawah ini banyak yang ter-enforce via guardrail (ESLint `modular-monolith/no-cross-module-import`, `BusinessError` typed, `RlsContext` AsyncLocalStorage). Bagian yang baru ditambahkan di batch ini:

- [Foundation Layer Anti-Patterns](#foundation-layer-anti-patterns) — kesalahan umum saat meng-integrasikan shared layer

---

## Foundation Layer Anti-Patterns

### 1. Direct Cross-Module Import

**Symptom:** Mengimpor entity, repository, atau service dari subfolder internal (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`) modul lain secara langsung.

```typescript
// ❌ Bad — bypass module boundary
// di modules/delivery/services/delivery.service.ts
import { OrderRepository } from '../../order/repositories/order.repository';
```

```typescript
// ✅ Good — konsumsi via public gate index.ts modul
import { OrderService } from '@/modules/order';

constructor(private readonly orderService: OrderService) {}

async getOrderDetails(orderId: string) {
  return this.orderService.getOrderById(orderId);
}
```

**Enforcement:** ESLint custom rule `modular-monolith/no-cross-module-import` (lihat `tools/eslint-rules/README.md`) memblokir import langsung ke subfolder internal (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`, dll.) lintas modul. Komunikasi antar modul wajib lewat root `modules/<name>` (`index.ts`), `modules/<name>/interfaces`, atau via async event bus `EventEmitter2`. Aturan yang sama melarang konsumsi langsung `DriverTokenRepository`/`FcmAdapter` dari modul lain — gunakan `PushNotificationModule` API.

### 2. Empty Catch / Swallow Exception

**Symptom:** `catch` kosong atau hanya log tanpa propagate, menyebabkan error hilang dari observability.

```typescript
// ❌ Bad — error hilang total
try {
  await this.payment.charge(amount);
} catch (e) {}

// ❌ Bad — log tanpa propagate (caller tidak tahu)
try {
  await this.payment.charge(amount);
} catch (e) {
  this.logger.error(e);
}
```

```typescript
// ✅ Good — log + lempar BusinessError typed
try {
  await this.payment.charge(amount);
} catch (e) {
  this.logger.error('Payment failed', { error: e, userId, amount });
  throw BusinessError.externalServiceUnavailable('payment-gateway', {
    userId,
    amount,
  });
}
```

**Foundation Layer convention:** Selalu lempar `BusinessError` (lihat `backend/docs/error-handling.md`) agar `AllExceptionsFilter` global dapat menerjemahkan ke HTTP envelope konsisten. Untuk event handler, tangkap error di handler itu sendiri dan emit event `*.failed` agar caller lain tidak kehilangan visibility.

### 3. Query di Loop (N+1)

**Symptom:** Database call di dalam `for`/`forEach`/`map` loop, termasuk loop yang terlihat "tidak terlihat" (misal `Promise.all` atas `findById`).

```typescript
// ❌ Bad — 1 + N queries
const orders = await this.orderRepo.findByorganization(organizationId);
for (const order of orders) {
  order.customer = await this.userRepo.findById(order.customerId);
}
```

```typescript
// ✅ Good — single query dengan eager loading (Drizzle `with`)
const orders = await this.db.query.orders.findMany({
  where: eq(ordersTable.organizationId, organizationId),
  with: { customer: true, items: { with: { product: true } } },
});
```

**Foundation Layer note:** Pola query Drizzle sudah ter-eager-load by `with`; repository method yang menerima `organizationId` **wajib** menyertakan `organizationId` di WHERE/RLS (lihat anti-pattern #4) sehingga tidak terjadi data leak antar organization. Pola batching detail lihat `backend/docs/performance-n-plus-one.md` dan `backend/docs/database.md`.

### 4. Missing `RlsContext.run` (Tenant Leak)

**Symptom:** Query multi-tenant dieksekusi di luar AsyncLocalStorage context, sehingga `current_setting('app.current_organization_id')` kosong dan RLS di DB tidak menyaring baris.

```typescript
// ❌ Bad — background job tanpa organization context
@Cron('*/5 * * * *')
async syncorganizationInventory() {
  const allorganizations = await this.organizationRepo.findAll();
  for (const organization of allorganizations) {
    await this.inventoryService.recalculate(organization.id); // organization.id tidak masuk RLS!
  }
}
```

```typescript
// ✅ Good — bungkus dengan RlsContext.run per organization
@Cron('*/5 * * * *')
async syncorganizationInventory() {
  const allorganizations = await this.organizationRepo.findAll();
  for (const organization of allorganizations) {
    await RlsContext.run(organization.id, () =>
      this.inventoryService.recalculate(),
    );
  }
}
```

**Wajib:** Setiap jalur eksekusi (HTTP request, background job, cron, event handler) yang menyentuh tabel dengan policy RLS **harus** memastikan `RlsContext` sudah ter-set. HTTP path biasanya ter-handle otomatis oleh `RlsInterceptor` (global), tapi job/handler async wajib `RlsContext.run(...)` manual. Lihat `backend/src/shared/README.md` bagian 2.

---

## Clean Code Anti-Patterns

### 1. God Class / God Function

**Symptom:** Class/function yang melakukan terlalu banyak hal.

```typescript
// ❌ Bad
class UserManager {
  createUser() {
    /* ... */
  }
  sendEmail() {
    /* ... */
  }
  generateReport() {
    /* ... */
  }
  processPayment() {
    /* ... */
  }
  validateInput() {
    /* ... */
  }
}

// ✅ Good - Split by responsibility
class UserService {
  createUser() {
    /* ... */
  }
}
class EmailService {
  sendEmail() {
    /* ... */
  }
}
class ReportService {
  generateReport() {
    /* ... */
  }
}
```

### 2. Feature Envy

**Symptom:** Method yang lebih banyak akses data dari class lain daripada class sendiri.

```typescript
// ❌ Bad
class OrderProcessor {
  calculateTotal(customer: Customer) {
    return customer.orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.qty, 0),
      0,
    );
  }
}

// ✅ Good - Move to where data lives
class Customer {
  calculateOrderTotal(): number {
    return this.orders.reduce((sum, o) => sum + o.getTotal(), 0);
  }
}
```

### 3. Primitive Obsession

**Symptom:** Menggunakan primitive types untuk domain concepts.

```typescript
// ❌ Bad
function createUser(email: string, phone: string, age: number) {}

// ✅ Good - Use value objects
function createUser(email: Email, phone: PhoneNumber, age: Age) {}

class Email {
  constructor(private value: string) {
    if (!this.isValid(value)) throw new InvalidEmailError();
  }
}
```

### 4. Long Parameter List

**Symptom:** Function dengan >4 parameter.

```typescript
// ❌ Bad
function createOrder(userId, productId, qty, price, discount, tax, shipping) {}

// ✅ Good - Use parameter object
interface CreateOrderDto {
  userId: string;
  productId: string;
  quantity: number;
  pricing: PricingDetails;
}
function createOrder(dto: CreateOrderDto) {}
```

### 5. Magic Numbers / Strings

**Symptom:** Hardcoded values tanpa penjelasan.

```typescript
// ❌ Bad
if (user.age >= 18) {
}
if (status === 'A') {
}

// ✅ Good - Use named constants
const MINIMUM_AGE = 18;
const STATUS_ACTIVE = 'A';

if (user.age >= MINIMUM_AGE) {
}
if (status === STATUS_ACTIVE) {
}
```

---

## Modular Monolith Anti-Patterns

### 1. Distributed Monolith

**Symptom:** Module terpisah tapi tetap tightly coupled.

```typescript
// ❌ Bad - Direct import internal
import { UserEntity } from '../user/entities/user.entity';

// ✅ Good - Import public API only
import { UserDto } from '../user/api';
```

### 2. Shared Database Table

**Symptom:** Multiple modules baca/tulis ke table yang sama.

```text
// ❌ Bad
[Order Module] ──read/write──> [users table] <──read/write── [User Module]

// ✅ Good - Each module owns its data
[Order Module] ──event──> [User Module] ──owns──> [users table]
```

### 3. Circular Dependencies

**Symptom:** Module A depends on B, B depends on A.

```text
// ❌ Bad
User Module ←→ Order Module

// ✅ Good - Use events or shared kernel
User Module → Event Bus ← Order Module
```

### 4. Anemic Domain Model

**Symptom:** Entity hanya berisi data, logic di service.

```typescript
// ❌ Bad - Logic di luar entity
class OrderService {
  cancel(order: Order) {
    if (order.status === 'shipped') throw new Error();
    order.status = 'cancelled';
  }
}

// ✅ Good - Rich domain model
class Order {
  cancel(): void {
    if (this.status === OrderStatus.Shipped) {
      throw new CannotCancelShippedOrderError();
    }
    this.status = OrderStatus.Cancelled;
  }
}
```

### 5. Leaky Abstraction

**Symptom:** Internal implementation bocor ke public API.

```typescript
// ❌ Bad - Expose internal entity
export { UserEntity } from './entities/user.entity';

// ✅ Good - Expose DTO only
export { UserDto } from './dto/user.dto';
export { UserService } from './user.service';
```

---

## Duplication Anti-Patterns

### 1. Copy-Paste Programming

**Detection:** Identical code blocks in multiple files.

```typescript
// ❌ Found in: userController.ts, orderController.ts, productController.ts
const validateRequest = (req) => {
  if (!req.body) throw new Error('Body required');
  if (!req.headers.authorization) throw new Error('Auth required');
};

// ✅ Solution: Extract to shared middleware
// shared/middleware/validation.middleware.ts
export const validateRequest = createValidationMiddleware({
  requireBody: true,
  requireAuth: true,
});
```

### 2. Similar But Different

**Detection:** Logic 80%+ similar with minor variations.

```typescript
// ❌ Bad - Almost identical functions
function getUserById(id: string) {
  const user = await db.user.findOne({ id });
  if (!user) throw new NotFoundError('User');
  return user;
}

function getOrderById(id: string) {
  const order = await db.order.findOne({ id });
  if (!order) throw new NotFoundError('Order');
  return order;
}

// ✅ Good - Generic with type parameter
function getById<T>(
  repository: Repository<T>,
  id: string,
  entityName: string,
): T {
  const entity = await repository.findOne({ id });
  if (!entity) throw new NotFoundError(entityName);
  return entity;
}
```

### 3. Repeated Validation

**Detection:** Same validation rules in multiple places.

```typescript
// ❌ Bad - Validation scattered
// In controller
if (!email.includes('@')) throw new Error();
// In service
if (!email.includes('@')) throw new Error();
// In entity
if (!email.includes('@')) throw new Error();

// ✅ Good - Single source of truth
class Email {
  constructor(value: string) {
    if (!Email.isValid(value)) throw new InvalidEmailError();
    this.value = value;
  }
  static isValid(value: string): boolean {
    return value.includes('@');
  }
}
```

### 4. Shotgun Surgery

**Symptom:** Satu perubahan butuh edit di banyak tempat.

**Solution:** Consolidate related code into single module/class.

---

## N+1 Query Anti-Patterns

### 1. Query dalam Loop

**Symptom:** Database call di dalam for/forEach/map loop.

```typescript
// ❌ Bad - 1 + N queries
const users = await userRepo.findAll();
for (const user of users) {
  const orders = await orderRepo.findByUserId(user.id);
  user.orders = orders;
}

// ✅ Good - 1 query dengan eager loading
const users = await userRepo.findAll({
  include: [{ model: Order }],
});

// ✅ Alternative - 2 queries dengan manual join
const users = await userRepo.findAll();
const userIds = users.map((u) => u.id);
const orders = await orderRepo.findByUserIds(userIds);
const ordersByUser = groupBy(orders, 'userId');
users.forEach((u) => (u.orders = ordersByUser[u.id] || []));
```

### 2. Lazy Loading Trap

**Symptom:** ORM lazy loads relations saat diakses.

```typescript
// ❌ Bad - Lazy load di template/response
const posts = await postRepo.findAll();
return posts.map((p) => ({
  title: p.title,
  authorName: p.author.name, // Triggers lazy load per post!
}));

// ✅ Good - Eager load upfront
const posts = await postRepo.findAll({
  relations: ['author'],
});
```

### 3. Sequential Async Operations

**Symptom:** await dalam loop tanpa parallelization.

```typescript
// ❌ Bad - Sequential, O(n) time
const results = [];
for (const id of ids) {
  const data = await fetchData(id);
  results.push(data);
}

// ✅ Good - Parallel, O(1) time
const results = await Promise.all(ids.map((id) => fetchData(id)));

// ✅ Good - Batch API call
const results = await fetchDataBatch(ids);
```

### 4. Missing Batch Operations

**Symptom:** Individual inserts/updates/deletes.

```typescript
// ❌ Bad - N insert queries
for (const item of items) {
  await repo.insert(item);
}

// ❌ Bad - N update queries
for (const user of users) {
  await repo.update(user.id, { status: 'active' });
}

// ✅ Good - Bulk insert
await repo.insertMany(items);

// ✅ Good - Bulk update
await repo.updateMany({ id: { $in: userIds } }, { status: 'active' });
```

### 5. Nested N+1

**Symptom:** N+1 di dalam N+1 (exponential queries).

```typescript
// ❌ Bad - 1 + N + N*M queries!
const departments = await deptRepo.findAll();
for (const dept of departments) {
  dept.employees = await empRepo.findByDeptId(dept.id);
  for (const emp of dept.employees) {
    emp.projects = await projectRepo.findByEmpId(emp.id); // Nested N+1!
  }
}

// ✅ Good - Single query dengan nested includes
const departments = await deptRepo.findAll({
  include: [
    {
      model: Employee,
      include: [Project],
    },
  ],
});
```

### 6. Count dalam Loop

**Symptom:** COUNT query untuk setiap item.

```typescript
// ❌ Bad - N count queries
const categories = await categoryRepo.findAll();
for (const cat of categories) {
  cat.productCount = await productRepo.count({ categoryId: cat.id });
}

// ✅ Good - Single aggregation query
const categories = await categoryRepo.findAll();
const counts = await productRepo.countByCategory(); // GROUP BY
categories.forEach((c) => (c.productCount = counts[c.id] || 0));
```

---

## Detection Commands

```bash
# Find long functions
graphify query "functions longer than 30 lines"

# Find high coupling
graphify query "modules with many external dependencies"

# Find similar code
graphify query "functions with similar implementation patterns"

# Find circular deps
graphify query "circular dependencies between modules"

# Find N+1 patterns
graphify query "database queries inside loops"

# Find sequential async
rg -n "for.*\{[^}]*await" --type ts
rg -n "forEach.*await|\.map\(async" --type ts

# Find hardcoded secrets
rg -n "(password|api[_-]?key|secret|token)\s*[:=]\s*['\"]" --type ts

# Find empty catch
rg -n "catch\s*(\w+)?\s*\{\s*\}" --type ts

# Find missing tests
find src/modules -name "*.service.ts" -not -name "*.spec.ts"
```

---

## Security Anti-Patterns

### 1. Hardcoded Secrets

**Symptom:** Credentials, API keys, atau tokens di-hardcode di source code.

```typescript
// ❌ Bad
const JWT_SECRET = 'super-secret-key-123';
const STRIPE_KEY = 'sk_live_abc123xyz';
const DB_PASSWORD = 'admin123';

// ✅ Good - Environment variables dengan validation
@Injectable()
export class ConfigService {
  private readonly jwtSecret: string;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be set and at least 32 chars');
    }
    this.jwtSecret = secret;
  }
}
```

### 2. SQL Injection

**Symptom:** User input langsung di-interpolate ke raw SQL.

```typescript
// ❌ Bad - Vulnerable!
async findUser(name: string) {
  return await db.query(
    `SELECT * FROM users WHERE name = '${name}'`
  );
  // Input: "'; DROP TABLE users; --" → DISASTER!
}

// ✅ Good - Parameterized
async findUser(name: string) {
  return await db.query(
    'SELECT * FROM users WHERE name = $1', [name]
  );
}

// ✅ Better - ORM (auto-escape)
async findUser(name: string) {
  return await this.userRepo.findOne({ where: { name } });
}
```

### 3. Missing Authentication/Authorization

**Symptom:** Endpoint accessible tanpa proper guards.

```typescript
// ❌ Bad - No auth check
@Controller('admin')
export class AdminController {
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.userService.delete(id); // Anyone can delete!
  }
}

// ✅ Good — Pakai @OrgRoles dari @thallesp/nestjs-better-auth
import { Controller, Delete, Param } from '@nestjs/common';
import { OrgRoles } from '@thallesp/nestjs-better-auth';

@Controller('admin')
export class AdminController {
  @Delete('users/:id')
  @OrgRoles('owner')
  deleteUser(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
```

### 4. Sensitive Data Exposure

**Symptom:** Password, token, atau PII di-log atau return ke client.

```typescript
// ❌ Bad - Sensitive data di log
logger.log('User data', { email, password, creditCard });
console.log('Token:', token);

// ✅ Good - Explicit redaction
logger.log('User created', {
  email,
  password: '[REDACTED]',
  creditCard: maskCreditCard(creditCard),
});
```

### 5. Unsafe Eval / Dynamic Code

**Symptom:** Penggunaan `eval`, `Function`, atau template literal yang execute kode.

```typescript
// ❌ Bad - Code injection risk
const result = eval(userProvidedFormula);
const fn = new Function('x', `return ${userCode}`);

// ✅ Good - Safe alternative
import { evaluate } from 'mathjs';
const result = evaluate(userProvidedFormula); // Sandboxed
```

### 6. Weak Cryptography

**Symptom:** Penggunaan algoritma yang sudah deprecated untuk security.

```typescript
// ❌ Bad
import md5 from 'md5';
const hash = md5(password);

// ✅ Good - Modern algorithms
import { hash, compare } from 'bcrypt';
const hashedPassword = await hash(password, 12);
const isValid = await compare(password, hashedPassword);
```

### 7. Missing Input Validation

**Symptom:** Request body langsung dipakai tanpa validation.

```typescript
// ❌ Bad - No validation
@Post()
create(@Body() dto: any) {
  return this.userService.create(dto);
}

// ✅ Good - Validate with class-validator
@Post()
create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/)
  password: string;

  @IsInt()
  @Min(0)
  @Max(150)
  age: number;
}
```

---

## Error Handling Anti-Patterns

### 1. Empty Catch Block

**Symptom:** Catch yang swallow exception tanpa action.

```typescript
// ❌ Bad - Error hilang total
try {
  await this.payment.charge(amount);
} catch (e) {}

// ❌ Bad - Silent failure
try {
  await this.payment.charge(amount);
} catch (e) {
  this.logger.error(e); // Log but don't propagate!
}

// ✅ Good - Log + propagate with context
try {
  await this.payment.charge(amount);
} catch (e) {
  this.logger.error('Payment failed', {
    error: e,
    context: { userId, amount },
  });
  throw new PaymentFailedException(userId, amount, e);
}
```

### 2. Generic Error Throws

**Symptom:** `throw new Error()` tanpa context atau error code.

```typescript
// ❌ Bad - No context, no type
if (!user) throw new Error('Not found');

// ❌ Bad - String-based error
throw new Error('USER_NOT_FOUND');

// ✅ Good - Typed error with code & metadata
export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super(`User ${userId} not found`, {
      code: 'USER_NOT_FOUND',
      httpStatus: HttpStatus.NOT_FOUND,
      metadata: { userId },
    });
  }
}

// Usage
if (!user) throw new UserNotFoundException(userId);
```

### 3. Error Type Loss

**Symptom:** Catch semua sebagai `Error` tanpa preserve original.

```typescript
// ❌ Bad - Original info lost
try {
  await externalApi.call();
} catch (e) {
  throw new Error('API call failed'); // Stack trace original hilang!
}

// ✅ Good - Preserve cause
try {
  await externalApi.call();
} catch (e) {
  throw new ApiCallException('Failed to call external API', {
    cause: e, // Modern JS supports cause
    context: { endpoint },
  });
}
```

### 4. Async Error Swallowing

**Symptom:** Promise yang tidak di-await atau error handler di async chain.

```typescript
// ❌ Bad - Fire and forget
async process(items: Item[]) {
  items.forEach(async (item) => {
    await this.process(item); // Unhandled rejection!
  });
}

// ❌ Bad - Promise without catch
this.heavyOperation().then(() => {
  this.cleanup();
});
// What if heavyOperation fails?

// ✅ Good - AllSettled atau proper await
async process(items: Item[]) {
  const results = await Promise.allSettled(
    items.map(item => this.process(item))
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    this.logger.warn(`${failures.length} items failed`, { failures });
  }
}
```

### 5. Inconsistent Error Response

**Symptom:** Format error response berbeda antara endpoints.

```typescript
// ❌ Bad - Inconsistent
return { error: 'User not found' }; // Endpoint A
throw new NotFoundException('User does not exist'); // Endpoint B
return { success: false, message: 'Failed', code: 404 }; // Endpoint C

// ✅ Good - Global filter ensures consistency
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { statusCode, message, code, metadata } = this.parseError(exception);

    response.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...(metadata && { metadata }),
      },
    });
  }
}
```

### 6. Catch-and-Return-Null

**Symptom:** Mengembalikan null saat error sehingga caller tidak tahu.

```typescript
// ❌ Bad - Caller tidak bisa bedakan "not found" vs "error"
async findUser(id: string): Promise<User | null> {
  try {
    return await this.userRepo.findOne({ where: { id } });
  } catch (e) {
    return null; // DB error atau not found? Caller tidak tahu!
  }
}

// ✅ Good - Throw untuk error, return null/optional untuk not found
async findUser(id: string): Promise<User | null> {
  const user = await this.userRepo.findOne({ where: { id } });
  return user; // null = not found (expected)
  // Kalau ada DB error, akan bubble up (unexpected)
}
```

### 7. Promise Rejection di Event Emitter

**Symptom:** Emit yang melakukan async tanpa error handling.

```typescript
// ❌ Bad
@OnEvent('user.created')
async handleUserCreated(user: User) {
  await this.sendWelcomeEmail(user); // If fails, silently lost
}

// ✅ Good
@OnEvent('user.created')
async handleUserCreated(user: User) {
  try {
    await this.sendWelcomeEmail(user);
  } catch (e) {
    this.logger.error('Failed to send welcome email', { error: e, userId: user.id });
    // Either retry or alert, but don't silently lose
    await this.notification.recordFailure(user.id, e);
  }
}
```

---

## Testing Anti-Patterns

### 1. Test yang Hit Real External Resources

**Symptom:** Test bergantung pada real DB, real HTTP, real file system.

```typescript
// ❌ Bad - Real DB
describe('UserService', () => {
  it('should create user', async () => {
    const user = await userService.create({ email: 'real@test.com' });
    // Connects to real DB, slow, flake, side effects
  });
});

// ❌ Bad - Real HTTP
it('should fetch data', async () => {
  const data = await service.callRealApi();
  // Depends on external service up
});

// ✅ Good - Mock everything
describe('UserService', () => {
  let service: UserService;
  let userRepo: MockType<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useFactory: () => ({
            save: jest.fn().mockResolvedValue(mockUser),
            findOne: jest.fn().mockResolvedValue(mockUser),
          }),
        },
      ],
    }).compile();

    service = module.get(UserService);
    userRepo = module.get(getRepositoryToken(User));
  });

  it('should create user', async () => {
    const result = await service.create({ email: 'test@test.com' });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@test.com' }),
    );
  });
});
```

### 2. Shared State Between Tests

**Symptom:** Variable di outer scope yang dipakai multiple tests.

```typescript
// ❌ Bad - Shared state
let createdUser: User;

beforeAll(async () => {
  createdUser = await userService.create({ email: 'shared@test.com' });
});

it('test A', () => {
  expect(createdUser.id).toBeDefined(); // Depends on test order!
});

it('test B', () => {
  expect(createdUser.email).toBe('shared@test.com'); // May be mutated
});

// ✅ Good - Fresh state per test
beforeEach(async () => {
  await db.clean();
  await seedTestData();
  createdUser = await userService.create({ email: 'fresh@test.com' });
});
```

### 3. Test Tanpa Assertion

**Symptom:** Test yang tidak verify apa-apa.

```typescript
// ❌ Bad - No assertion, always pass
it('should work', async () => {
  const result = await service.doSomething();
  // No expect! Test passes even if result is wrong
});

// ❌ Bad - Only logging
it('should do X', async () => {
  const result = await service.doX();
  console.log('Result:', result);
  // Human reads logs, CI doesn't catch bugs
});

// ✅ Good - Explicit assertions
it('should return user when found', async () => {
  const result = await service.findById('valid-id');
  expect(result).toEqual(mockUser);
  expect(result.email).toBe('test@test.com');
  expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'valid-id' } });
});
```

### 4. Missing Edge Cases

**Symptom:** Test hanya happy path.

```typescript
// ❌ Bad - Only happy path
describe('divide', () => {
  it('divides', () => {
    expect(divide(10, 2)).toBe(5);
  });
});

// ✅ Good - Edge cases covered
describe('divide', () => {
  it('divides positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow(DivisionByZeroError);
  });

  it('handles negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('handles very large numbers', () => {
    expect(divide(Number.MAX_SAFE_INTEGER, 2)).toBeDefined();
  });

  it('handles decimal results', () => {
    expect(divide(1, 3)).toBeCloseTo(0.333, 2);
  });
});
```

### 5. Brittle Tests

**Symptom:** Test yang break setiap refactor walaupun behavior masih benar.

```typescript
// ❌ Bad - Test implementation detail
it('should call save with exact object', () => {
  await service.create({ email: 'test@test.com', password: 'pass' });
  expect(userRepo.save).toHaveBeenCalledWith({
    email: 'test@test.com',
    password: 'pass',
    createdAt: new Date('2024-01-01'), // Break kalau timestamp berubah!
    id: 'uuid-here',
  });
});

// ✅ Good - Test behavior & public API
it('should create user with hashed password', async () => {
  const result = await service.create({
    email: 'test@test.com',
    password: 'plain',
  });
  expect(result.email).toBe('test@test.com');
  expect(result.password).not.toBe('plain'); // Behavior, not impl
  expect(userRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'test@test.com' }),
  );
});
```

### 6. Sleep/Delay Anti-Pattern

**Symptom:** `setTimeout` atau `sleep` di test untuk tunggu async.

```typescript
// ❌ Bad - Fragile timing
it('should update', async () => {
  await service.triggerUpdate();
  await sleep(1000); // Hope it's done by now
  expect(cache.get('key')).toBe('value');
});

// ✅ Good - Wait for actual condition
it('should update', async () => {
  await service.triggerUpdate();
  await waitFor(() => cache.get('key') === 'value', { timeout: 5000 });
  expect(cache.get('key')).toBe('value');
});
```

### 7. Test Naming yang Buruk

**Symptom:** Nama test yang tidak descriptive.

```typescript
// ❌ Bad
it('test 1', () => {});
it('works', () => {});
it('case', () => {});
it('login', () => {}); // Apa yang di-test?

// ✅ Good - Behavior-focused
it('should return user when valid credentials provided', () => {});
it('should throw InvalidCredentialsError when password is wrong', () => {});
it('should set httpOnly cookie when remember me is true', () => {});
```

### 8. Coverage Theater

**Symptom:** High coverage tapi test tidak verify behavior yang penting.

```typescript
// ❌ Bad - Coverage tanpa value
it('covers line 45', () => {
  try {
    service.riskyMethod();
  } catch (e) {} // Cover catch, but don't verify behavior
});

it('runs method', () => {
  service.someMethod(); // Just execute, no assertion
});

// ✅ Good - Meaningful coverage
it('should rollback transaction when payment fails', async () => {
  jest.spyOn(payment, 'charge').mockRejectedValue(new Error('Failed'));
  await expect(service.processOrder(orderId)).rejects.toThrow(
    PaymentFailedError,
  );
  expect(db.rollback).toHaveBeenCalled();
});
```

### 9. Test Interdependence

**Symptom:** Test yang bergantung pada test lain yang jalan sebelumnya.

```typescript
// ❌ Bad - Test B depends on Test A
it('1. should create user', async () => {
  globalUserId = await userService.create({ email: 'a@test.com' });
});

it('2. should find user', async () => {
  // Assumes test 1 ran!
  const user = await userService.findById(globalUserId);
  expect(user).toBeDefined();
});

// ✅ Good - Independent tests
describe('User operations', () => {
  beforeEach(async () => {
    // Fresh setup for each test
    globalUserId = await userService.create({ email: 'a@test.com' });
  });

  it('should find user by id', async () => {
    const user = await userService.findById(globalUserId);
    expect(user.email).toBe('a@test.com');
  });
});
```

### 10. Mock yang Salah

**Symptom:** Mock yang tidak match real behavior.

```typescript
// ❌ Bad - Mock returns nothing
it('should send notification', async () => {
  notificationService.send = jest.fn(); // Mock returns undefined
  await service.registerUser(userData);
  expect(notificationService.send).toHaveBeenCalled(); // Passes but...
  // Real bug tidak ke-detect: notification tidak actually sent
});

// ✅ Good - Mock returns realistic value
it('should send notification', async () => {
  notificationService.send = jest
    .fn()
    .mockResolvedValue({ messageId: 'msg-123' });
  await service.registerUser(userData);
  expect(notificationService.send).toHaveBeenCalledWith(
    expect.objectContaining({ template: 'welcome' }),
  );
});
```

---

## Summary Checklist untuk Project Review

Saat menjalankan full analysis, checklist berikut membantu:

```markdown
Security:

- [ ] Tidak ada hardcoded secret di source
- [ ] Semua endpoint protected dengan auth guard
- [ ] Input divalidasi di boundary
- [ ] PII tidak bocor di log

Error Handling:

- [ ] Tidak ada empty catch
- [ ] Custom error types dengan code
- [ ] Global exception filter untuk konsistensi
- [ ] Async operation punya error handling

Testing:

- [ ] Service files punya companion spec
- [ ] Test menggunakan mock, bukan real DB/HTTP
- [ ] Edge cases ter-cover
- [ ] Test names descriptive
- [ ] No shared state antar tests
```

---

## API Design Anti-Patterns

### 1. Unpaginated List Endpoint

**Symptom:** Endpoint list return seluruh data tanpa pagination.

```typescript
// ❌ Bad - No pagination
@Get()
async findAll(): Promise<User[]> {
  return this.userService.findAll(); // Bisa return millions of rows!
}

// ✅ Good - Paginated
@Get()
async findAll(@Query() pagination: PaginationDto): Promise<Paginated<UserDto>> {
  return this.userService.findAll(pagination);
}
```

### 2. Returning Raw Entity

**Symptom:** Controller return entity langsung, expose internal fields.

```typescript
// ❌ Bad - Returns entity (leaks password, internalNotes, etc)
@Get(':id')
async findOne(@Param('id') id: string): Promise<User> {
  return this.userService.findById(id);
}

// ✅ Good - Returns DTO
@Get(':id')
@ApiResponse({ type: UserResponseDto })
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  const user = await this.userService.findById(id);
  return UserResponseDto.fromEntity(user);
}
```

### 3. Wrong HTTP Method

**Symptom:** Penggunaan HTTP method yang tidak sesuai dengan REST convention.

```typescript
// ❌ Bad
@Post('update/:id')   // POST untuk update
@Get('delete/:id')    // GET untuk delete (cached!)
@Post('get/:id')      // POST untuk read

// ✅ Good - RESTful
@Put(':id')           // Full update
@Patch(':id')         // Partial update
@Delete(':id')        // Delete
@Get(':id')           // Read
```

### 4. Inconsistent Response Shape

**Symptom:** Endpoint mengembalikan struktur response yang berbeda-beda.

```typescript
// ❌ Bad - 4 different shapes across endpoints
@Get(':id')
async findOne() {
  return this.userService.findById(id); // User object
}

@Get()
async findAll() {
  return { items: await this.userService.findAll() }; // {items: []}
}

@Post()
async create() {
  return { success: true, data: await this.userService.create(dto) }; // {success, data}
}

@Get('count')
async count() {
  return 42; // Just number
}

// ✅ Good - Consistent via interceptor
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### 5. No API Versioning

**Symptom:** Breaking changes langsung affect semua client.

```typescript
// ❌ Bad - No versioning
@Controller('users')
export class UsersController {
  @Get(':id')
  findOne() {
    // Returns { id, email, name }
  }
}

// Later: rename email to emailAddress
// All clients break immediately!

// ✅ Good - Versioned
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {
  // New response shape
}
```

### 6. Missing OpenAPI/Swagger Documentation

**Symptom:** Endpoint tanpa Swagger annotations.

```typescript
// ❌ Bad - No docs
@Post()
async create(@Body() dto: CreateUserDto): Promise<User> {
  return this.userService.create(dto);
}

// ✅ Good - Full Swagger docs
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, type: ValidationErrorDto })
  @ApiResponse({ status: 409, description: 'Email exists' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }
}
```

### 7. Inconsistent REST Naming

**Symptom:** Plural/singular tidak konsisten.

```typescript
// ❌ Bad
@Controller('user')      // Singular
@Controller('orders')    // Plural
@Controller('payments')  // Plural
@Controller('category')  // Singular

// ✅ Good - Consistent plural
@Controller('users')
@Controller('orders')
@Controller('payments')
@Controller('categories')
```

---

## Configuration Anti-Patterns

### 1. Scattered process.env Access

**Symptom:** `process.env` diakses di banyak tempat tanpa sentralisasi.

```typescript
// ❌ Bad - Access scattered everywhere
@Injectable()
export class UserService {
  async sendEmail(user: User) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const timeout = process.env.EMAIL_TIMEOUT;
    // No validation, crash if missing
  }
}

@Injectable()
export class PaymentService {
  async charge(amount: number) {
    const key = process.env.STRIPE_KEY;
    // Another scattered access
  }
}

// ✅ Good - Centralized config
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {
    this.validate();
  }

  get sendgrid() {
    return {
      apiKey: this.config.getOrThrow('SENDGRID_API_KEY'),
      fromEmail: this.config.getOrThrow('FROM_EMAIL'),
      timeout: parseInt(this.config.get('EMAIL_TIMEOUT') || '5000'),
    };
  }

  get stripe() {
    return {
      apiKey: this.config.getOrThrow('STRIPE_KEY'),
    };
  }
}
```

### 2. No Env Validation at Startup

**Symptom:** Env var divalidasi manual atau saat runtime, bukan startup.

```typescript
// ❌ Bad - No validation, crash saat first request
const jwtSecret = process.env.JWT_SECRET;

@Injectable()
export class AuthService {
  sign(payload: any) {
    return jwt.sign(payload, jwtSecret); // Throws: secret missing
  }
}

// ✅ Good - Joi/Zod validation at startup
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('dev', 'prod', 'test').required(),
  JWT_SECRET: Joi.string().min(32).required(),
  DATABASE_URL: Joi.string().uri().required(),
});

// In main.ts
const { error } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}
```

### 3. Hardcoded URLs/Hosts

**Symptom:** URL atau host di-hardcode di source code.

```typescript
// ❌ Bad - Hardcoded
const apiClient = axios.create({
  baseURL: 'https://api.production.com',
});

const webhookUrl = 'https://api.stripe.com/webhooks';

// ✅ Good - From env
const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL,
});

const webhookUrl = process.env.STRIPE_WEBHOOK_URL;
```

### 4. Default Values for Secrets

**Symptom:** Default value untuk secret yang harus required.

```typescript
// ❌ Bad - Default secret (security risk!)
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const API_KEY = process.env.API_KEY || 'test-key';

// ✅ Good - Fail fast if missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and >= 32 chars');
}
```

### 5. Type Coercion Issues

**Symptom:** Env values dipakai tanpa parse (string vs number).

```typescript
// ❌ Bad - String comparison
if (process.env.MAX_CONNECTIONS > 100) {
  // "50" > 100? LEXICOGRAPHIC! "50" > "100" is true!
}

// ❌ Bad - Boolean check
if (process.env.ENABLE_CACHE === true) {
} // Always false, env is string

// ✅ Good - Explicit coercion
const maxConnections = parseInt(process.env.MAX_CONNECTIONS || '10', 10);
if (maxConnections > 100) {
}

const enableCache = process.env.ENABLE_CACHE === 'true';

// ✅ Better - Schema validator that coerces
const envSchema = Joi.object({
  MAX_CONNECTIONS: Joi.number().default(10),
  ENABLE_CACHE: Joi.boolean().default(false),
});
```

### 6. Missing .env.example

**Symptom:** Tidak ada `.env.example` sebagai dokumentasi required env.

```bash
# ❌ Bad - New devs harus baca source code untuk tau env yang dibutuhkan
# Tidak ada .env.example

# ✅ Good - Document ALL required env
# .env.example
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=myapp

# Auth (REQUIRED, no default)
JWT_SECRET=
JWT_EXPIRES_IN=7d

# External Services
SENDGRID_API_KEY=
STRIPE_SECRET_KEY=

# Feature Flags
ENABLE_CACHE=true
LOG_LEVEL=info
```

---

## Dependency Health Anti-Patterns

### 1. Outdated Major Versions

**Symptom:** Dependency tertinggal major version yang signifikan.

```json
// ❌ Bad
{
  "dependencies": {
    "next": "^12.0.0",       // Latest is 15
    "react": "^16.14.0",     // Latest is 18
    "@nestjs/core": "^8.0.0" // Latest is 10
  }
}

// ✅ Good - Current versions
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "@nestjs/core": "^10.0.0"
  }
}
```

### 2. Dev Dependencies in Production

**Symptom:** Build/test tools di dependencies.

```json
// ❌ Bad - Dev tools di dependencies
{
  "dependencies": {
    "express": "^4.18.0",
    "nodemon": "^3.0.0",    // Should be devDependencies
    "ts-node": "^10.9.0",   // Should be devDependencies
    "eslint": "^9.0.0"      // Should be devDependencies
  }
}

// ✅ Good - Proper separation
{
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "ts-node": "^10.9.0",
    "eslint": "^9.0.0"
  }
}
```

### 3. Unused Dependencies

**Symptom:** Package di-install tapi tidak pernah di-import.

```json
// ❌ Bad - Listed tapi tidak dipakai
{
  "dependencies": {
    "lodash": "^4.17.21",        // Tidak pernah di-import
    "moment": "^2.29.0",          // Tidak pernah di-import
    "axios": "^1.6.0",            // Tidak pernah di-import
    "express": "^4.18.0"          // Hanya ini yang dipakai
  }
}

// ✅ Good - Only what's used
{
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

**Detect dengan `npx depcheck`:**

```bash
$ npx depcheck
Unused dependencies: lodash, moment, axios
```

### 4. Deprecated Packages

**Symptom:** Package yang sudah deprecated.

```json
// ❌ Bad - Deprecated packages
{
  "dependencies": {
    "request": "^2.88.0",      // Deprecated, use axios/got
    "node-uuid": "^1.4.8",     // Deprecated, use uuid
    "@types/node-uuid": "^1.4.0"
  }
}

// ✅ Good - Modern alternatives
{
  "dependencies": {
    "axios": "^1.6.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

### 5. Security Vulnerabilities

**Symptom:** Package dengan known vulnerabilities.

```bash
# Check vulnerabilities
$ bun audit
┌───────────────┬──────────────────────────────────┐
│ lodash        │ Prototype Pollution              │
├───────────────┼──────────────────────────────────┤
│ Severity      │ high                             │
│ More info     │ https://github.com/advisories/... │
└───────────────┴──────────────────────────────────┘

# ✅ Fix: bun upgrade lodash@^4.17.21
```

### 6. Multiple Versions Installed

**Symptom:** Package yang sama ter-install multiple versi.

```bash
$ bun list --depth=0 | grep -E "^[├└]" | sort
├─ react@16.14.0  # Old version still here
├─ react@18.2.0   # Plus new version

# Causes bundle bloat, version conflicts

# ✅ Fix: bun upgrade react@^18.0.0
```

### 7. Wildcard Versions

**Symptom:** Dependency version tidak di-pin.

```json
// ❌ Bad - Could break anytime
{
  "dependencies": {
    "express": "*",         // Any version, dangerous!
    "lodash": "latest",     // Always latest, can't be reproduced
    "react": "^0.0.1"       // Caret allows major bump if < 1.0
  }
}

// ✅ Good - Pinned ranges
{
  "dependencies": {
    "express": "^4.18.2",   // Compatible with 4.x
    "lodash": "~4.17.21",   // Patch only (4.17.x)
    "react": "18.2.0"       // Exact pin
  }
}
```

---

## Database Schema Anti-Patterns

### 1. Missing Index on Queryable Columns

**Symptom:** Query WHERE/ORDER BY di kolom tanpa index.

```typescript
// ❌ Bad - No index on email
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string; // Often queried by email → full table scan!
}

// ✅ Good - Index on queryable columns
@Entity()
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;
}

// Prisma
model User {
  id    String @id @default(uuid())
  email String @unique

  @@index([email])
}
```

### 2. Missing Foreign Key Constraint

**Symptom:** FK reference tanpa constraint.

```typescript
// ❌ Bad - FK without constraint
@Column()
userId: string;

// ✅ Good - FK with constraint
@ManyToOne(() => User, user => user.posts, {
  onDelete: 'CASCADE',
  nullable: false,
})
@JoinColumn({ name: 'user_id' })
user: User;

// Prisma
model Post {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

### 3. Inconsistent Soft Delete

**Symptom:** Mix hard delete dan soft delete.

```typescript
// ❌ Bad - Inconsistent
await this.userRepo.delete(id); // Hard delete here
await this.postRepo.softDelete({ id }); // Soft delete there
// Hard to query "deleted" items, audit trail lost

// ✅ Good - Consistent soft delete
@Entity()
export class User {
  @DeleteDateColumn()
  deletedAt: Date | null;
}

@Injectable()
export class UserService {
  async delete(id: string) {
    await this.userRepo.softDelete({ id }); // Always soft
  }

  async findActive() {
    return this.userRepo.find({ where: { deletedAt: IsNull() } });
  }
}
```

### 4. Wrong Index Order

**Symptom:** Composite index dengan kolom order yang salah.

```typescript
// ❌ Bad - Wrong order for query
@Index(['status', 'userId'])
// Query: WHERE user_id = ? AND status = ?
// → Doesn't use index efficiently!

// ✅ Good - Order matches query filter
@Index(['userId', 'status'])
// Query: WHERE user_id = ? AND status = ?
// → Uses index, fast lookup

// Rule: Most selective column first
// Query: WHERE status = 'active' AND user_id = ?
// @Index(['status', 'userId']) if status has few distinct values
```

### 5. No Migration Discipline

**Symptom:** Schema changes tanpa migration files.

```bash
# ❌ Bad - Schema drift
# Edit prisma/schema.prisma
# Run: prisma db push (directly modify DB)
# No migration file = no audit trail, can't rollback in prod

# ✅ Good - Migration discipline
# 1. Edit schema.prisma
# 2. bun prisma migrate dev --name add_user_phone
# 3. Commit migration files
# 4. CI: bun prisma migrate deploy (dry-run)
# 5. Prod: bun prisma migrate deploy
```

### 6. Storing JSON Without Validation

**Symptom:** JSON column tanpa schema.

```typescript
// ❌ Bad - JSON without schema
@Column('jsonb')
metadata: any; // Any structure allowed

// ✅ Good - JSON with class-validator or JSON Schema
@Column('jsonb')
@ValidateNested()
@Type(() => UserMetadataDto)
metadata: UserMetadataDto;

export class UserMetadataDto {
  @IsString()
  source: 'web' | 'mobile' | 'api';

  @IsOptional()
  @IsString()
  referrer?: string;
}
```

---

## Logging & Observability Anti-Patterns

### 1. console.log di Production Code

**Symptom:** Penggunaan console.log bukan proper logger.

```typescript
// ❌ Bad - console.log everywhere
@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    console.log('Creating user:', dto);
    const user = await this.userRepo.save(dto);
    console.log('User created:', user);
    return user;
  }
}

// ✅ Good - Logger dengan context
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`, 'UserService.create');

    try {
      const user = await this.userRepo.save(dto);
      this.logger.log(`User created: ${user.id}`, 'UserService.create');
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to create user: ${error.message}`,
        error.stack,
        'UserService.create',
      );
      throw error;
    }
  }
}
```

### 2. Missing Correlation ID

**Symptom:** Request tidak punya correlation ID untuk tracing.

```typescript
// ❌ Bad - No way to trace
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    console.log('Request received');
    return next.handle();
  }
}

// ✅ Good - Correlation ID propagated
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] || randomUUID();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

### 3. Wrong Log Level

**Symptom:** Penggunaan log level yang tidak sesuai.

```typescript
// ❌ Bad - Wrong levels
this.logger.error('User created successfully'); // Should be log
this.logger.log('Payment failed!'); // Should be error
this.logger.error('Cache miss, using fallback'); // Should be warn

// ✅ Good - Correct semantics
this.logger.log('User created'); // Info: normal flow
this.logger.warn('Cache miss, using fallback'); // Warn: recoverable
this.logger.error('Payment failed', stackTrace); // Error: failed op
this.logger.debug('SQL query', { sql }); // Debug: dev info
this.logger.verbose('Function called'); // Verbose: trace
```

### 4. Logging Sensitive Data

**Symptom:** Log yang berisi PII atau secrets.

```typescript
// ❌ Bad - Sensitive data in logs
this.logger.log('Login attempt', { email, password });
this.logger.log('User profile', user); // Includes password, creditCard
this.logger.debug('API call', { headers, body }); // Includes Authorization

// ✅ Good - Explicit redaction
this.logger.log('Login attempt', { email });
this.logger.log('User profile', sanitizeUser(user));
this.logger.debug('API call', { url, headers: redactHeaders(headers) });
```

### 5. No Metrics for Critical Operations

**Symptom:** Business critical operations tanpa telemetry.

```typescript
// ❌ Bad - Blind operation
@Injectable()
export class OrderService {
  async processOrder(orderId: string) {
    const order = await this.orderRepo.findById(orderId);
    await this.payment.charge(order);
    await this.fulfillment.ship(order);
    // No metrics, no visibility
  }
}

// ✅ Good - Metrics for monitoring
@Injectable()
export class OrderService {
  private readonly ordersProcessed = new Counter({
    name: 'orders_processed_total',
    labelNames: ['status'],
  });

  private readonly processingDuration = new Histogram({
    name: 'order_processing_duration_seconds',
    labelNames: ['status'],
  });

  async processOrder(orderId: string) {
    const stopTimer = this.processingDuration.startTimer();

    try {
      // ... business logic ...
      this.ordersProcessed.inc({ status: 'success' });
    } catch (error) {
      this.ordersProcessed.inc({ status: 'failure' });
      throw error;
    } finally {
      stopTimer();
    }
  }
}
```

### 6. Missing Health Check

**Symptom:** Tidak ada endpoint untuk cek status dependencies.

```typescript
// ❌ Bad - Only basic liveness
@Get('health')
health() {
  return { status: 'ok' }; // Doesn't check DB, Redis, external APIs
}

// ✅ Good - Liveness + Readiness
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: MicroserviceHealthIndicator,
  ) {}

  @Get('liveness')
  liveness() {
    return this.health.check([
      () => ({ app: () => ({ status: 'up' }) }),
    ]);
  }

  @Get('readiness')
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.externalApi.pingCheck('payment'),
    ]);
  }
}
```

### 7. High-Volume Logging Tanpa Sampling

**Symptom:** Log setiap request, overwhelms log storage.

```typescript
// ❌ Bad - Log every request
this.logger.log('Request received', { body });

// ✅ Good - Sample for high-volume
if (Math.random() < 0.01) {
  // 1% sampling
  this.logger.debug('Request received (sampled)', { requestId });
}
// Always log errors & warnings, only sample info
```

### 8. Cross-Module Logging Leak

**Symptom:** Satu modul men-log field/properti dari entity/instance modul lain — baik untuk observability maupun untuk debugging.

```typescript
// ❌ Bad - modul audit men-log field internal Order
@OnEvent('order.created')
async handle(payload: OrderCreatedEvent) {
  // Import langsung entity modul lain → boundary bocor
  const order = await this.orderRepo.findById(payload.orderId);
  this.logger.log('Order detail', {
    customerPhone: order.customer.phone, // data PII dari modul lain!
    organizationId: order.organizationId,
  });
}
```

```typescript
// ✅ Good - gunakan API publik modul pengirim
@OnEvent('order.created')
async handle(payload: OrderCreatedEvent) {
  // payload hanya berisi informasi yang secara contract dipublish-kan
  // oleh modul 'order'. Tidak ada field yang keluar dari api/DTO publik.
  this.logger.log('Order created', {
    orderId: payload.orderId,
    organizationId: payload.organizationId, // sudah merupakan bagian payload
  });
}
```

**Foundation Layer convention:** Modul `audit`/`notification`/monitoring **tidak** boleh query balik entity modul lain hanya untuk keperluannya logging. Bentuk payload event harus mencukupi; jika kurang, tambahkan field ke event payload (bukan lewat query langsung). Lihat `backend/src/shared/README.md` bagian 1 untuk kontrak `DomainEventMap` dan `backend/src/shared/README.md` bagian 5 untuk ESLint guardrail.
