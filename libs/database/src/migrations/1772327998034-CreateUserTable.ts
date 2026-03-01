import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserTable1772327998034 implements MigrationInterface {
    name = 'CreateUserTable1772327998034'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_name" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "public_key" character varying(255) NOT NULL, CONSTRAINT "UQ_074a1f262efaca6aba16f7ed920" UNIQUE ("user_name"), CONSTRAINT "UQ_2c65307fa5c22f843f6c1089b18" UNIQUE ("public_key"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_updated_at_id" ON "users" ("updated_at", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_updated_at_id"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
