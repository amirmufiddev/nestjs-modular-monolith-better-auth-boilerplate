import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TemplateService } from '../application/template.service';
import { TemplateResponseDto } from './dto/template-list-response.dto';

/**
 * Controller contoh — salin dari regional/presentation/regional.controller.ts.
 * Tidak terdaftar di AppModule (scaffold only).
 */
@ApiTags('Template (scaffold)')
@Controller('template-scaffold')
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'Scaffold placeholder — do not expose in production boilerplate',
  })
  @ApiOkResponse({ type: [TemplateResponseDto] })
  list(): Promise<TemplateResponseDto[]> {
    return this.service.listItems();
  }
}
