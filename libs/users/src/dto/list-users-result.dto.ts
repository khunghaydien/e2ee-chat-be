import { UserEntity } from '@app/database';

/** Kết quả list user có cursor. */
export interface ListUsersResultDto {
  items: UserEntity[];
  nextCursor: string | null;
}
