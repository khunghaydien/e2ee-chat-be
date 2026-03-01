import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bật extension pg_trgm để dùng search gần đúng (similarity).
 * Sau khi chạy migration này, có thể dùng addTrgmSearch(..., 'trgm') trong code.
 */
export class EnablePgTrgm1770280000000 implements MigrationInterface {
  name = 'EnablePgTrgm1770280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
