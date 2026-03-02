import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/** Query cho API lấy danh sách conversations (cursor pagination) */
export class ListConversationsQueryDto {
  /** Cursor = id của conversation cuối trang trước (để lấy trang tiếp theo) */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
