import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateConversationTable1772423423324 implements MigrationInterface {
    name = 'UpdateConversationTable1772423423324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_conversations_type_updated_id"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "conversation_type"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_conversation_type_enum"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "conversation_title"`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_type_enum" AS ENUM('PRIVATE', 'GROUP')`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "type" "public"."conversations_type_enum" NOT NULL DEFAULT 'PRIVATE'`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "title" character varying(255)`);
        await queryRunner.query(`CREATE INDEX "idx_conversations_type_updated_id" ON "conversations" ("type", "updated_at", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_conversations_type_updated_id"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_type_enum"`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "conversation_title" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_conversation_type_enum" AS ENUM('PRIVATE', 'GROUP')`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "conversation_type" "public"."conversations_conversation_type_enum" NOT NULL DEFAULT 'PRIVATE'`);
        await queryRunner.query(`CREATE INDEX "idx_conversations_type_updated_id" ON "conversations" ("conversation_type", "id", "updated_at") `);
    }

}
