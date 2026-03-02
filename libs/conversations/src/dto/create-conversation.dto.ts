import { IsArray, ArrayMinSize, IsUUID, IsOptional, IsIn } from 'class-validator';

/** Body cho API tạo conversation (1-1: participantIds = [userId của người còn lại]) */
export class CreateConversationDto {
  @IsOptional()
  @IsIn(['PRIVATE', 'GROUP'])
  type?: 'PRIVATE' | 'GROUP' = 'PRIVATE';

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantIds: string[];
}
