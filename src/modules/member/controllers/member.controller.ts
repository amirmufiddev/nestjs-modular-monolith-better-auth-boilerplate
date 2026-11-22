import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { OrgRoles, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { BusinessError } from '@/common/errors/business-error';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { MEMBER_ROLES } from '@/modules/auth/constants/auth.constants';
import { RequirePermission } from '@/modules/rbac/decorators';
import { RlsContext } from '@/shared/database/rls-context';
import { MemberService } from '../services/member.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  ListMemberQueryDto,
  MemberResponseDto,
  InvitationResponseDto,
} from '../dto';

@ApiTags('Admin / Members')
@ApiExtraModels(MemberResponseDto, InvitationResponseDto, ErrorResponseDto)
@Controller('admin/members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  private requireActiveOrganizationId(): string {
    const organizationId = RlsContext.getCurrentOrganizationId();
    if (!organizationId) {
      throw BusinessError.unauthorized(
        'Anda harus memiliki organisasi aktif untuk mengelola anggota.',
        'ORGANIZATION_REQUIRED',
      );
    }
    return organizationId;
  }

  @Get()
  @ApiBearerAuth()
  @OrgRoles([MEMBER_ROLES.OWNER])
  @RequirePermission('member:read')
  @ApiOperation({ summary: 'Mendapatkan daftar anggota organization aktif' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(MemberResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: ListMemberQueryDto,
  ): Promise<PaginatedResponseDto<MemberResponseDto>> {
    const organizationId = this.requireActiveOrganizationId();
    const { data, total } = await this.memberService.listByOrganization(
      organizationId,
      {
        role: query.role,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      },
    );
    const items = data.map(MemberResponseDto.fromEntity);
    return PaginatedResponseDto.from(items, total, query.page, query.limit);
  }

  @Get(':id')
  @ApiBearerAuth()
  @OrgRoles([MEMBER_ROLES.OWNER])
  @RequirePermission('member:read')
  @ApiOperation({ summary: 'Mendapatkan detail anggota' })
  @ApiResponse({ status: HttpStatus.OK, type: MemberResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  async getById(@Param('id') id: string): Promise<MemberResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    const member = await this.memberService.getById(organizationId, id);
    if (!member) {
      throw BusinessError.notFound('Member', id);
    }
    return MemberResponseDto.fromEntity(member);
  }

  @Post('invite')
  @ApiBearerAuth()
  @OrgRoles([MEMBER_ROLES.OWNER])
  @RequirePermission('member:invite')
  @ApiOperation({ summary: 'Mengundang anggota baru' })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvitationResponseDto })
  async invite(
    @Body() body: InviteMemberDto,
    @Req() req: FastifyRequest,
    @Session() session: UserSession,
  ): Promise<InvitationResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    const invitation = await this.memberService.inviteMember({
      organizationId,
      email: body.email,
      role: body.role,
      inviterUserId: session.user.id,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
    return InvitationResponseDto.from(invitation);
  }

  @Patch(':id/role')
  @ApiBearerAuth()
  @OrgRoles([MEMBER_ROLES.OWNER])
  @RequirePermission('member:update-role')
  @ApiOperation({ summary: 'Memperbarui role anggota' })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiResponse({ status: HttpStatus.OK, type: MemberResponseDto })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, type: ErrorResponseDto })
  async updateRole(
    @Param('id') id: string,
    @Body() body: UpdateMemberRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<MemberResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    await this.memberService.updateRole(
      organizationId,
      id,
      body.role,
      req.headers as Record<string, string | string[] | undefined>,
    );
    const member = await this.memberService.getById(organizationId, id);
    if (!member) {
      throw BusinessError.notFound('Member', id);
    }
    return MemberResponseDto.fromEntity(member);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @OrgRoles([MEMBER_ROLES.OWNER])
  @RequirePermission('member:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Menghapus anggota dari organisasi' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const organizationId = this.requireActiveOrganizationId();
    await this.memberService.removeMember(
      organizationId,
      id,
      req.headers as Record<string, string | string[] | undefined>,
    );
  }
}
