# Modular Monolith & SOLID Architecture Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the codebase architecture from DDD multi-layer (`api/`, `application/`, `domain/`, `facade/`, `infrastructure/`, `presentation/`) to an idiomatic NestJS Modular Monolith strictly enforcing the 5 SOLID principles (SRP, OCP, LSP, ISP, DIP).

**Architecture:** Each module in `src/modules/<name>/` adopts a standardized feature structure: `controllers/`, `services/`, `repositories/`, `interfaces/`, `dto/`, `<name>.module.ts`, and `index.ts`. Data access uses DIP via NestJS injection tokens (`Symbol`) with pure TypeScript interfaces (ISP). Cross-module communication is gated through module `index.ts` and event-driven decoupled handlers (`EventEmitter2`), strictly enforced by a custom ESLint boundary rule.

**Tech Stack:** NestJS 11, TypeScript, Drizzle ORM, Fastify, EventEmitter2, Bun test, ESLint.

## Global Constraints

- All modules MUST use the standardized folder structure: `controllers/`, `services/`, `repositories/`, `interfaces/`, `dto/`, `<module>.module.ts`, `index.ts`.
- Repositories MUST implement an interface from `interfaces/` and be injected via `Symbol` injection token (`@Inject(TOKEN)`).
- Services MUST contain only business logic and use-case orchestration (\(\le 300\) lines).
- Controllers MUST contain only HTTP transport, guard/interceptor decorators, and Swagger documentation.
- No cross-module imports to internal subfolders (`controllers/`, `services/`, `repositories/`). Imports must resolve to the target module's `index.ts` (e.g. `../member` or `src/modules/member`).
- All existing tests MUST pass with `bun test`.
- ESLint checks MUST pass with `bun run lint`.
- Build MUST pass with `bun run build`.

---

### Task 1: Update ESLint Boundary Rule (`no-cross-module-import`)

**Files:**
- Modify: `tools/eslint-rules/no-cross-module-import.mjs`
- Test: `bun run lint`

**Interfaces:**
- Consumes: AST ImportDeclaration from ESLint parser.
- Produces: ESLint error when importing internal subfolders (`controllers`, `services`, `repositories`, `infrastructure`, `domain`, `presentation`, `facade`, `application`, `api`) of another module; permits importing from root module (`modules/<name>` or `modules/<name>/index`) or `modules/<name>/interfaces`.

- [ ] **Step 1: Update `tools/eslint-rules/no-cross-module-import.mjs`**

Update rule logic to disallow cross-module imports into internal directories, but allow root and interfaces imports:

```javascript
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
```

- [ ] **Step 2: Verify ESLint rule with `bun run lint`**

Run: `bun run lint`
Expected: Passes or surfaces expected existing violations to be refactored in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add tools/eslint-rules/no-cross-module-import.mjs
git commit -m "feat(lint): update no-cross-module-import rule to guard modular internal subfolders"
```

---

### Task 2: Refactor `_template` to Modular SOLID Blueprint

**Files:**
- Create:
  - `src/modules/_template/interfaces/template-repository.interface.ts`
  - `src/modules/_template/interfaces/index.ts`
  - `src/modules/_template/controllers/template.controller.ts`
  - `src/modules/_template/services/template.service.ts`
  - `src/modules/_template/repositories/template.repository.ts`
  - `src/modules/_template/dto/create-template.dto.ts`
  - `src/modules/_template/dto/update-template.dto.ts`
  - `src/modules/_template/dto/template-response.dto.ts`
  - `src/modules/_template/dto/index.ts`
  - `src/modules/_template/template.module.ts`
  - `src/modules/_template/index.ts`
  - `src/modules/_template/README.md`
- Delete:
  - `src/modules/_template/api/`
  - `src/modules/_template/application/`
  - `src/modules/_template/facade/`
  - `src/modules/_template/infrastructure/`
  - `src/modules/_template/presentation/`

**Interfaces:**
- Consumes: `BaseRepository` from `src/common/repository/base.repository.ts`.
- Produces: `TEMPLATE_REPOSITORY_TOKEN`, `ITemplateRepository`, `TemplateService`, `TemplateController`, `TemplateModule`.

- [ ] **Step 1: Create `src/modules/_template/interfaces/template-repository.interface.ts` and `interfaces/index.ts`**

```typescript
// src/modules/_template/interfaces/template-repository.interface.ts
export const TEMPLATE_REPOSITORY_TOKEN = Symbol('TEMPLATE_REPOSITORY_TOKEN');

export interface TemplateItem {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplateRepository {
  findById(id: string): Promise<TemplateItem | null>;
  findByName(name: string, organizationId: string): Promise<TemplateItem | null>;
  create(data: { name: string; organizationId: string }): Promise<TemplateItem>;
  delete(id: string): Promise<void>;
}
```

```typescript
// src/modules/_template/interfaces/index.ts
export * from './template-repository.interface';
```

- [ ] **Step 2: Create DTOs in `src/modules/_template/dto/`**

```typescript
// src/modules/_template/dto/create-template.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Template Sample', description: 'Name of the template' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
```

```typescript
// src/modules/_template/dto/update-template.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
```

```typescript
// src/modules/_template/dto/template-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({ example: 'tpl_123' })
  id!: string;

  @ApiProperty({ example: 'Template Sample' })
  name!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}
```

```typescript
// src/modules/_template/dto/index.ts
export * from './create-template.dto';
export * from './update-template.dto';
export * from './template-response.dto';
```

- [ ] **Step 3: Create Repository, Service, Controller, and Module in `_template`**

```typescript
// src/modules/_template/repositories/template.repository.ts
import { Injectable } from '@nestjs/common';
import { ITemplateRepository, TemplateItem } from '../interfaces/template-repository.interface';

@Injectable()
export class TemplateRepository implements ITemplateRepository {
  private items: Map<string, TemplateItem> = new Map();

  async findById(id: string): Promise<TemplateItem | null> {
    return this.items.get(id) ?? null;
  }

  async findByName(name: string, organizationId: string): Promise<TemplateItem | null> {
    for (const item of this.items.values()) {
      if (item.name === name && item.organizationId === organizationId) {
        return item;
      }
    }
    return null;
  }

  async create(data: { name: string; organizationId: string }): Promise<TemplateItem> {
    const item: TemplateItem = {
      id: `tpl_${Date.now()}`,
      name: data.name,
      organizationId: data.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(item.id, item);
    return item;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
```

```typescript
// src/modules/_template/services/template.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { BusinessError } from '../../../common/errors/business.error';
import {
  ITemplateRepository,
  TEMPLATE_REPOSITORY_TOKEN,
  TemplateItem,
} from '../interfaces/template-repository.interface';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @Inject(TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepo: ITemplateRepository,
  ) {}

  async getById(id: string): Promise<TemplateItem> {
    const item = await this.templateRepo.findById(id);
    if (!item) {
      throw BusinessError.notFound('Template not found', 'TEMPLATE_NOT_FOUND', { id });
    }
    return item;
  }

  async create(dto: CreateTemplateDto, organizationId: string): Promise<TemplateItem> {
    const existing = await this.templateRepo.findByName(dto.name, organizationId);
    if (existing) {
      throw BusinessError.conflict('Template name already exists', 'TEMPLATE_NAME_CONFLICT', {
        name: dto.name,
      });
    }
    return this.templateRepo.create({ name: dto.name, organizationId });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.templateRepo.delete(id);
  }
}
```

```typescript
// src/modules/_template/controllers/template.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TemplateService } from '../services/template.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { TemplateResponseDto } from '../dto/template-response.dto';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';

@ApiTags('Template')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get(':id')
  @RequirePermission('template:read')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, type: TemplateResponseDto })
  async findOne(@Param('id') id: string): Promise<TemplateResponseDto> {
    return this.templateService.getById(id);
  }

  @Post()
  @RequirePermission('template:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create template' })
  @ApiResponse({ status: 201, type: TemplateResponseDto })
  async create(@Body() dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    return this.templateService.create(dto, 'default_org');
  }

  @Delete(':id')
  @RequirePermission('template:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete template' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.templateService.delete(id);
  }
}
```

```typescript
// src/modules/_template/template.module.ts
import { Module } from '@nestjs/common';
import { TemplateController } from './controllers/template.controller';
import { TemplateService } from './services/template.service';
import { TemplateRepository } from './repositories/template.repository';
import { TEMPLATE_REPOSITORY_TOKEN } from './interfaces/template-repository.interface';

@Module({
  controllers: [TemplateController],
  providers: [
    TemplateService,
    {
      provide: TEMPLATE_REPOSITORY_TOKEN,
      useClass: TemplateRepository,
    },
  ],
  exports: [TemplateService, TEMPLATE_REPOSITORY_TOKEN],
})
export class TemplateModule {}
```

```typescript
// src/modules/_template/index.ts
export * from './template.module';
export * from './services/template.service';
export * from './interfaces';
export * from './dto';
```

- [ ] **Step 4: Remove obsolete `api/`, `application/`, `facade/`, `infrastructure/`, `presentation/` in `_template` and update `README.md`**

Remove deprecated folders:
```bash
rm -rf src/modules/_template/api src/modules/_template/application src/modules/_template/facade src/modules/_template/infrastructure src/modules/_template/presentation
```
Update `src/modules/_template/README.md` to reflect the new structure.

- [ ] **Step 5: Verify build & tests**

Run: `bun run lint && bun test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/_template
git commit -m "refactor(_template): convert skeleton to idiomatic modular and SOLID architecture"
```

---

### Task 3: Refactor `regional` Module to Modular SOLID

**Files:**
- Create:
  - `src/modules/regional/interfaces/regional-repository.interface.ts`
  - `src/modules/regional/interfaces/index.ts`
  - `src/modules/regional/dto/index.ts`
- Move & Refactor:
  - `src/modules/regional/presentation/regional.controller.ts` -> `src/modules/regional/controllers/regional.controller.ts`
  - `src/modules/regional/presentation/regional.controller.spec.ts` -> `src/modules/regional/controllers/regional.controller.spec.ts`
  - `src/modules/regional/presentation/dto/*` & `src/modules/regional/api/dto/*` -> `src/modules/regional/dto/`
  - `src/modules/regional/application/regional.service.ts` -> `src/modules/regional/services/regional.service.ts`
  - `src/modules/regional/application/regional.service.spec.ts` -> `src/modules/regional/services/regional.service.spec.ts`
  - `src/modules/regional/infrastructure/regional.repository.ts` -> `src/modules/regional/repositories/regional.repository.ts`
  - `src/modules/regional/infrastructure/regional.repository.spec.ts` -> `src/modules/regional/repositories/regional.repository.spec.ts`
  - `src/modules/regional/regional.module.ts` (update DI providers to inject via `REGIONAL_REPOSITORY_TOKEN`)
  - `src/modules/regional/index.ts`
- Delete:
  - `src/modules/regional/api/`
  - `src/modules/regional/application/`
  - `src/modules/regional/facade/`
  - `src/modules/regional/infrastructure/`
  - `src/modules/regional/presentation/`

**Interfaces:**
- Consumes: Drizzle database schema (`provinces`, `regencies`, `districts`, `villages`).
- Produces: `REGIONAL_REPOSITORY_TOKEN`, `IRegionalRepository`, `RegionalService`, `RegionalController`, `RegionalModule`.

- [ ] **Step 1: Create `src/modules/regional/interfaces/regional-repository.interface.ts` and `interfaces/index.ts`**

```typescript
// src/modules/regional/interfaces/regional-repository.interface.ts
import { PaginatedResult } from '../../../common/dto/paginated-response.dto';
import {
  DistrictItemDto,
  ProvinceItemDto,
  RegencyItemDto,
  VillageItemDto,
} from '../dto/regional.dto';

export const REGIONAL_REPOSITORY_TOKEN = Symbol('REGIONAL_REPOSITORY_TOKEN');

export interface ListProvincesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListRegenciesParams {
  provinceId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListDistrictsParams {
  regencyId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListVillagesParams {
  districtId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IRegionalRepository {
  findProvinces(params: ListProvincesParams): Promise<PaginatedResult<ProvinceItemDto>>;
  findRegencies(params: ListRegenciesParams): Promise<PaginatedResult<RegencyItemDto>>;
  findDistricts(params: ListDistrictsParams): Promise<PaginatedResult<DistrictItemDto>>;
  findVillages(params: ListVillagesParams): Promise<PaginatedResult<VillageItemDto>>;
  findProvinceById(id: string): Promise<ProvinceItemDto | null>;
  findRegencyById(id: string): Promise<RegencyItemDto | null>;
  findDistrictById(id: string): Promise<DistrictItemDto | null>;
  findVillageById(id: string): Promise<VillageItemDto | null>;
}
```

```typescript
// src/modules/regional/interfaces/index.ts
export * from './regional-repository.interface';
```

- [ ] **Step 2: Move and reorganize `dto/` in `regional`**

Move DTOs:
- `src/modules/regional/api/dto/regional.dto.ts` -> `src/modules/regional/dto/regional.dto.ts`
- `src/modules/regional/presentation/dto/regional-list-response.dto.ts` -> `src/modules/regional/dto/regional-list-response.dto.ts`
- Create `src/modules/regional/dto/index.ts`:
```typescript
export * from './regional.dto';
export * from './regional-list-response.dto';
```

- [ ] **Step 3: Move and refactor `RegionalRepository` and `RegionalService`**

- Move `src/modules/regional/infrastructure/regional.repository.ts` to `src/modules/regional/repositories/regional.repository.ts`, ensure it implements `IRegionalRepository`.
- Move `src/modules/regional/application/regional.service.ts` to `src/modules/regional/services/regional.service.ts`:
```typescript
@Injectable()
export class RegionalService {
  constructor(
    @Inject(REGIONAL_REPOSITORY_TOKEN)
    private readonly regionalRepo: IRegionalRepository,
  ) {}
  // ... methods remain focused on business use case
}
```
- Update `src/modules/regional/controllers/regional.controller.ts` imports to reference `../services/regional.service` and `../dto/regional.dto`.

- [ ] **Step 4: Update `src/modules/regional/regional.module.ts` and `src/modules/regional/index.ts`**

```typescript
// src/modules/regional/regional.module.ts
import { Module } from '@nestjs/common';
import { RegionalController } from './controllers/regional.controller';
import { RegionalService } from './services/regional.service';
import { RegionalRepository } from './repositories/regional.repository';
import { REGIONAL_REPOSITORY_TOKEN } from './interfaces/regional-repository.interface';

@Module({
  controllers: [RegionalController],
  providers: [
    RegionalService,
    {
      provide: REGIONAL_REPOSITORY_TOKEN,
      useClass: RegionalRepository,
    },
  ],
  exports: [RegionalService, REGIONAL_REPOSITORY_TOKEN],
})
export class RegionalModule {}
```

```typescript
// src/modules/regional/index.ts
export * from './regional.module';
export * from './services/regional.service';
export * from './interfaces';
export * from './dto';
```

- [ ] **Step 5: Clean up old folders in `regional/` and update spec files**

Remove `src/modules/regional/api`, `application`, `facade`, `infrastructure`, `presentation`.
Update tests:
- `src/modules/regional/services/regional.service.spec.ts` (mock `REGIONAL_REPOSITORY_TOKEN`)
- `src/modules/regional/repositories/regional.repository.spec.ts`
- `src/modules/regional/controllers/regional.controller.spec.ts`

- [ ] **Step 6: Run tests and verify**

Run: `bun test src/modules/regional`
Expected: All regional tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/regional
git commit -m "refactor(regional): migrate to modular solid architecture with repository token DIP"
```

---

### Task 4: Refactor `member` Module to Modular SOLID

**Files:**
- Create:
  - `src/modules/member/interfaces/member-repository.interface.ts`
  - `src/modules/member/interfaces/index.ts`
  - `src/modules/member/dto/index.ts`
- Move & Refactor:
  - `src/modules/member/presentation/member.controller.ts` -> `src/modules/member/controllers/member.controller.ts`
  - `src/modules/member/presentation/member.controller.spec.ts` -> `src/modules/member/controllers/member.controller.spec.ts`
  - `src/modules/member/presentation/dto/*` & `src/modules/member/api/dto/*` -> `src/modules/member/dto/`
  - `src/modules/member/application/member.service.ts` -> `src/modules/member/services/member.service.ts`
  - `src/modules/member/application/member.service.spec.ts` -> `src/modules/member/services/member.service.spec.ts`
  - `src/modules/member/infrastructure/member.repository.ts` -> `src/modules/member/repositories/member.repository.ts`
  - `src/modules/member/infrastructure/member.repository.spec.ts` -> `src/modules/member/repositories/member.repository.spec.ts`
  - `src/modules/member/infrastructure/pending-member-link.schema.ts` -> `src/modules/member/repositories/pending-member-link.schema.ts`
  - `src/modules/member/infrastructure/member-accepted.bridge.ts` -> `src/modules/member/services/member-accepted.bridge.ts`
  - `src/modules/member/infrastructure/member.module.ts` -> `src/modules/member/member.module.ts`
  - `src/modules/member/index.ts`
- Modify:
  - `src/modules/auth/auth.ts` (replace `MemberFacade` / `MEMBER_API` with `MemberService`)
  - `src/app.module.ts` (update `MemberModule` import path from `./modules/member`)
- Delete:
  - `src/modules/member/api/`
  - `src/modules/member/application/`
  - `src/modules/member/domain/`
  - `src/modules/member/facade/`
  - `src/modules/member/infrastructure/`
  - `src/modules/member/presentation/`

**Interfaces:**
- Consumes: Better Auth DB schema, `EventEmitter2`, `OrganizationRoleService` from `../rbac`.
- Produces: `MEMBER_REPOSITORY_TOKEN`, `IMemberRepository`, `MemberService`, `MemberModule`.

- [ ] **Step 1: Create `src/modules/member/interfaces/member-repository.interface.ts` and `interfaces/index.ts`**

```typescript
// src/modules/member/interfaces/member-repository.interface.ts
import { PaginatedResult } from '../../../common/dto/paginated-response.dto';
import { MemberListItemDto } from '../dto/member-response.dto';
import { ListMemberQueryDto } from '../dto/list-member-query.dto';

export const MEMBER_REPOSITORY_TOKEN = Symbol('MEMBER_REPOSITORY_TOKEN');

export interface MemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface IMemberRepository {
  findById(id: string): Promise<MemberRecord | null>;
  findByOrgAndUser(orgId: string, userId: string): Promise<MemberRecord | null>;
  listByOrg(orgId: string, query: ListMemberQueryDto): Promise<PaginatedResult<MemberListItemDto>>;
  updateRole(memberId: string, role: string): Promise<MemberRecord>;
  delete(memberId: string): Promise<void>;
  createPendingLink(data: { invitationId: string; role: string; organizationId: string }): Promise<void>;
  findPendingLink(invitationId: string): Promise<{ role: string; organizationId: string } | null>;
  deletePendingLink(invitationId: string): Promise<void>;
}
```

```typescript
// src/modules/member/interfaces/index.ts
export * from './member-repository.interface';
```

- [ ] **Step 2: Move and consolidate DTOs in `src/modules/member/dto/`**

Move all DTOs from `api/dto/` and `presentation/dto/` to `src/modules/member/dto/`.
Export all from `src/modules/member/dto/index.ts`.

- [ ] **Step 3: Move and refactor Repository and Service in `member`**

- Move `infrastructure/member.repository.ts` to `repositories/member.repository.ts` and implement `IMemberRepository`.
- Move `infrastructure/pending-member-link.schema.ts` to `repositories/pending-member-link.schema.ts`.
- Move `application/member.service.ts` to `services/member.service.ts`, inject `@Inject(MEMBER_REPOSITORY_TOKEN) private readonly memberRepo: IMemberRepository`.
- Move `infrastructure/member-accepted.bridge.ts` to `services/member-accepted.bridge.ts`.
- Move `presentation/member.controller.ts` to `controllers/member.controller.ts`.

- [ ] **Step 4: Update `MemberModule` and `index.ts`**

Move `src/modules/member/infrastructure/member.module.ts` to `src/modules/member/member.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { MemberController } from './controllers/member.controller';
import { MemberService } from './services/member.service';
import { MemberRepository } from './repositories/member.repository';
import { MemberAcceptedBridge } from './services/member-accepted.bridge';
import { MEMBER_REPOSITORY_TOKEN } from './interfaces/member-repository.interface';
import { RbacModule } from '../rbac';

@Module({
  imports: [RbacModule],
  controllers: [MemberController],
  providers: [
    MemberService,
    MemberAcceptedBridge,
    {
      provide: MEMBER_REPOSITORY_TOKEN,
      useClass: MemberRepository,
    },
  ],
  exports: [MemberService, MEMBER_REPOSITORY_TOKEN],
})
export class MemberModule {}
```

Create `src/modules/member/index.ts`:
```typescript
export * from './member.module';
export * from './services/member.service';
export * from './interfaces';
export * from './dto';
```

- [ ] **Step 5: Update callers of `MemberModule` and `MEMBER_API`**

Update `src/app.module.ts` (import `{ MemberModule } from './modules/member'`).
Update `src/modules/auth/auth.ts` (replace any `MEMBER_API` usage with `MemberService`).
Delete `src/modules/member/api`, `application`, `domain`, `facade`, `infrastructure`, `presentation`.

- [ ] **Step 6: Update spec files and run tests**

Update `src/modules/member/services/member.service.spec.ts`, `member.repository.spec.ts`, `member.controller.spec.ts`.
Run: `bun test src/modules/member`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/member src/modules/auth src/app.module.ts
git commit -m "refactor(member): migrate to modular solid architecture with member service public entrypoint"
```

---

### Task 5: Refactor `upload` Module to Decoupled SOLID (DIP & OCP)

**Files:**
- Create:
  - `src/modules/upload/interfaces/object-storage.interface.ts`
  - `src/modules/upload/interfaces/index.ts`
- Move & Refactor:
  - `src/modules/upload/infrastructure/s3-object-storage.service.ts` -> `src/modules/upload/adapters/s3-object-storage.adapter.ts`
  - `src/modules/upload/infrastructure/s3-object-storage.service.spec.ts` -> `src/modules/upload/adapters/s3-object-storage.adapter.spec.ts`
  - `src/modules/upload/upload.controller.ts` -> `src/modules/upload/controllers/upload.controller.ts`
  - `src/modules/upload/upload.controller.spec.ts` -> `src/modules/upload/controllers/upload.controller.spec.ts`
  - `src/modules/upload/upload.service.ts` -> `src/modules/upload/services/upload.service.ts`
  - `src/modules/upload/upload.service.spec.ts` -> `src/modules/upload/services/upload.service.spec.ts`
  - `src/modules/upload/upload.module.ts`
  - `src/modules/upload/index.ts`
- Delete:
  - `src/modules/upload/infrastructure/`
  - `src/modules/upload/upload.tokens.ts` (consolidated into `interfaces/`)

**Interfaces:**
- Consumes: AWS S3 SDK.
- Produces: `OBJECT_STORAGE_TOKEN`, `IObjectStorageService`, `UploadService`, `UploadModule`.

- [ ] **Step 1: Create `interfaces/object-storage.interface.ts` and `interfaces/index.ts`**

```typescript
// src/modules/upload/interfaces/object-storage.interface.ts
export const OBJECT_STORAGE_TOKEN = Symbol('OBJECT_STORAGE_TOKEN');

export interface PutObjectOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface GetObjectResult {
  body: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
}

export interface IObjectStorageService {
  putObject(options: PutObjectOptions): Promise<{ key: string; url?: string }>;
  getObject(key: string): Promise<GetObjectResult>;
  deleteObject(key: string): Promise<void>;
  getSignedDownloadUrl?(key: string, expiresInSeconds: number): Promise<string>;
}
```

```typescript
// src/modules/upload/interfaces/index.ts
export * from './object-storage.interface';
```

- [ ] **Step 2: Move adapter and refactor service & controller**

- Move `infrastructure/s3-object-storage.service.ts` to `adapters/s3-object-storage.adapter.ts`, implementing `IObjectStorageService`.
- Move `upload.service.ts` to `services/upload.service.ts`, injecting `@Inject(OBJECT_STORAGE_TOKEN) private readonly storage: IObjectStorageService`.
- Move `upload.controller.ts` to `controllers/upload.controller.ts`.
- Update `src/modules/upload/upload.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { S3ObjectStorageAdapter } from './adapters/s3-object-storage.adapter';
import { OBJECT_STORAGE_TOKEN } from './interfaces/object-storage.interface';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    {
      provide: OBJECT_STORAGE_TOKEN,
      useClass: S3ObjectStorageAdapter,
    },
  ],
  exports: [UploadService, OBJECT_STORAGE_TOKEN],
})
export class UploadModule {}
```
- Create `src/modules/upload/index.ts`:
```typescript
export * from './upload.module';
export * from './services/upload.service';
export * from './interfaces';
```

- [ ] **Step 3: Update upload tests and verify**

Move tests to corresponding folders, update spec imports.
Run: `bun test src/modules/upload`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/upload
git commit -m "refactor(upload): decouple object storage via IObjectStorageService interface token and modular structure"
```

---

### Task 6: Align `rbac`, `email`, and `health` Modules to Modular Standard

**Files:**
- Create:
  - `src/modules/rbac/interfaces/organization-role-repository.interface.ts`
  - `src/modules/rbac/interfaces/rbac-permission-repository.interface.ts`
  - `src/modules/rbac/interfaces/index.ts`
  - `src/modules/rbac/index.ts`
  - `src/modules/email/index.ts`
  - `src/modules/health/index.ts`
- Modify:
  - `src/modules/rbac/repositories/organization-role.repository.ts`
  - `src/modules/rbac/repositories/rbac-permission.repository.ts`
  - `src/modules/rbac/services/organization-role.service.ts`
  - `src/modules/rbac/services/rbac-permission.service.ts`
  - `src/modules/rbac/rbac.module.ts`

**Interfaces:**
- Consumes: Drizzle database schema (`organizationRole`, `rbacPermission`).
- Produces: `ORGANIZATION_ROLE_REPOSITORY_TOKEN`, `RBAC_PERMISSION_REPOSITORY_TOKEN`, cleanly exported via `src/modules/rbac/index.ts`.

- [ ] **Step 1: Create repository interfaces and tokens in `src/modules/rbac/interfaces/`**

Create:
- `src/modules/rbac/interfaces/organization-role-repository.interface.ts` (`ORGANIZATION_ROLE_REPOSITORY_TOKEN`, `IOrganizationRoleRepository`)
- `src/modules/rbac/interfaces/rbac-permission-repository.interface.ts` (`RBAC_PERMISSION_REPOSITORY_TOKEN`, `IRbacPermissionRepository`)
- `src/modules/rbac/interfaces/index.ts`

- [ ] **Step 2: Inject repository tokens in `OrganizationRoleService` and `RbacPermissionService`**

Update `organization-role.service.ts`:
```typescript
@Inject(ORGANIZATION_ROLE_REPOSITORY_TOKEN)
private readonly roleRepo: IOrganizationRoleRepository
```
Update `rbac-permission.service.ts`:
```typescript
@Inject(RBAC_PERMISSION_REPOSITORY_TOKEN)
private readonly permissionRepo: IRbacPermissionRepository
```
Update `src/modules/rbac/rbac.module.ts` providers with `{ provide: TOKEN, useClass: Repository }`.

- [ ] **Step 3: Create `index.ts` in `rbac`, `email`, and `health`**

Create `src/modules/rbac/index.ts` exporting module, public services, decorators, types, and DTOs.
Create `src/modules/email/index.ts` exporting `EmailModule` and `EmailService`.
Create `src/modules/health/index.ts` exporting `HealthModule`.

- [ ] **Step 4: Run tests in `rbac`, `email`, and `health`**

Run: `bun test src/modules/rbac src/modules/email src/modules/health`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/rbac src/modules/email src/modules/health
git commit -m "refactor(rbac,email,health): introduce repository tokens and index boundary exports"
```

---

### Task 7: Update Documentation & Workspace Rules

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/modular-monolith.md`
- Modify: `docs/clean-code.md`
- Modify: `docs/scaffold-new-module.md`
- Modify: `.cursor/rules/modular-architecture.mdc`

**Interfaces:**
- Consumes: Architecture specifications from `docs/superpowers/specs/2026-11-20-modular-solid-architecture-design.md`.
- Produces: Updated markdown documentation aligned 100% with Modular Monolith and SOLID principles.

- [ ] **Step 1: Update `docs/architecture.md`**

Replace DDD bounded-context philosophy section with Modular Monolith + SOLID principles (SRP, OCP, LSP, ISP, DIP). Update the diagram and layer directory tree to reflect `controllers/`, `services/`, `repositories/`, `interfaces/`, `dto/`, `index.ts`.

- [ ] **Step 2: Update `docs/modular-monolith.md` and `docs/clean-code.md`**

Update `docs/modular-monolith.md` module structure and cross-module boundary instructions.
Update `docs/clean-code.md` examples to show repository injection token DIP.

- [ ] **Step 3: Update `docs/scaffold-new-module.md` and `.cursor/rules/modular-architecture.mdc`**

Update scaffold steps to reference the new `_template` layout.
Update `.cursor/rules/modular-architecture.mdc` to enforce importing via module root `index.ts`.

- [ ] **Step 4: Commit**

```bash
git add docs/ .cursor/rules/modular-architecture.mdc
git commit -m "docs: update architecture guidelines and rules for modular solid boilerplate"
```

---

### Task 8: Comprehensive Verification & Knowledge Graph Sync

**Files:**
- Run full checks across the entire repo.

- [ ] **Step 1: Run ESLint**

Run: `bun run lint`
Expected: 0 errors.

- [ ] **Step 2: Run Full Test Suite**

Run: `bun test`
Expected: 100% test suites pass.

- [ ] **Step 3: Run TypeScript Build**

Run: `bun run build`
Expected: Compilation succeeds with 0 errors.

- [ ] **Step 4: Update Graphify Knowledge Graph**

Run: `graphify update .`
Expected: AST graph updated.

- [ ] **Step 5: Final git status check and commit (if any remaining changes)**

Run: `git status`
Expected: Working tree clean.
