import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description: 'URL akses file yang berhasil diunggah',
    example: '/uploads/abc123xyz.jpg',
  })
  url!: string;
}
