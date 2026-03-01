/** Query options: search (trgm email), cursor pagination. */
export interface ListUsersOptionsDto {
  /** Search gần đúng theo email (pg_trgm). */
  search?: string;
  /** Cursor: id của item cuối trang trước (index updated_at, id). */
  cursor?: string;
  /** Số item mỗi trang (mặc định 20). */
  limit?: number;
}
