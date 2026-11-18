import { ApiProperty } from '@nestjs/swagger';

export class SseHealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 3, description: 'Jumlah koneksi SSE aktif' })
  activeConnections!: number;
}
