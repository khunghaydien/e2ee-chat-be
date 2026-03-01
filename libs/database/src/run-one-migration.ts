/**
 * Chạy đúng một migration theo tên hoặc timestamp.
 *
 * Cách dùng:
 *   npx ts-node -r tsconfig-paths/register libs/database/src/run-one-migration.ts <tên hoặc timestamp>
 *
 * Ví dụ:
 *   npm run migration:run:one -- 1770280000000
 *   npm run migration:run:one -- EnablePgTrgm1770280000000
 */
import 'dotenv/config';
import dataSource from './data-source';
import { MigrationExecutor } from 'typeorm';

async function main() {
  const nameOrTimestamp = process.argv[2]?.trim();
  if (!nameOrTimestamp) {
    console.error('Thiếu tham số: truyền tên migration hoặc timestamp (vd: 1770280000000 hoặc EnablePgTrgm1770280000000)');
    process.exit(1);
  }

  await dataSource.initialize();

  try {
    const executor = new MigrationExecutor(dataSource);
    const all = await executor.getAllMigrations();
    const migration = all.find(
      (m) =>
        m.name === nameOrTimestamp ||
        m.name.endsWith(nameOrTimestamp) ||
        String(m.timestamp) === nameOrTimestamp,
    );

    if (!migration) {
      console.error(`Không tìm thấy migration: ${nameOrTimestamp}`);
      console.error('Các migration có sẵn:', all.map((m) => m.name).join(', '));
      process.exit(1);
    }

    const executed = await executor.getExecutedMigrations();
    if (executed.some((e) => e.name === migration.name)) {
      console.log(`Migration đã chạy rồi: ${migration.name}`);
      process.exit(0);
    }

    await executor.executeMigration(migration);
    console.log(`Đã chạy migration: ${migration.name}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
