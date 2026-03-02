import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersPublicKeyToText1772500000000 implements MigrationInterface {
  name = 'UsersPublicKeyToText1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "public_key" TYPE text USING "public_key"::text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "public_key" TYPE character varying(255) USING "public_key"::varchar`,
    );
  }
}
