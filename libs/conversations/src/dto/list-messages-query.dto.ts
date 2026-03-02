import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/** Query cho API lấy danh sách messages theo conversation (cursor pagination) */
export class ListMessagesQueryDto {
  /** Cursor = id của message cuối trang trước */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
