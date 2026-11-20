import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
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
