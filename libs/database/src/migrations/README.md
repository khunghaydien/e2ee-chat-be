# Migrations Guide

## Tạo Migration mới

### 1. Generate Migration từ Entities (Khuyên dùng)

Tạo migration tự động dựa trên sự khác biệt giữa entities và database hiện tại:

```bash
npm run migration:generate libs/database/src/migrations/MigrationName
```

**Ví dụ:** Tạo migration từ User entity:

```bash
npm run migration:generate libs/database/src/migrations/CreateUserTable
```

### 2. Tạo Migration trống (Manual)

Tạo file migration trống để viết SQL thủ công:

```bash
npm run migration:create libs/database/src/migrations/MigrationName
```

## Chạy Migrations

```bash
# Chạy tất cả migrations chưa được chạy
npm run migration:run

# Chạy đúng một migration (theo tên hoặc timestamp)
npm run migration:run:one -- 1770280000000
npm run migration:run:one -- EnablePgTrgm1770280000000

# Revert migration cuối cùng
npm run migration:revert

# Xem trạng thái migrations
npm run migration:show
```

## Các lệnh Migration

| Lệnh                                    | Mô tả                              |
| --------------------------------------- | ---------------------------------- |
| `npm run migration:generate <path>`     | Generate migration từ entities     |
| `npm run migration:create <path>`       | Tạo migration file trống           |
| `npm run migration:run`                 | Chạy tất cả migrations pending     |
| `npm run migration:run:one -- <name>`   | Chạy đúng một migration (tên/ts)   |
| `npm run migration:revert`               | Revert migration cuối cùng         |
| `npm run migration:show`               | Hiển thị status của migrations     |

## Lưu ý

- Đảm bảo đã cấu hình các biến môi trường trong file `.env`:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USERNAME`
  - `DB_PASSWORD`
  - `DB_DATABASE`
  - `NODE_ENV`

- Khi generate migration, TypeORM sẽ so sánh entities với database hiện tại
- Chỉ những thay đổi mới sẽ được tạo thành migration
- Migration files sẽ được tạo trong `libs/database/src/migrations/`
