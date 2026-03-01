import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersModule as UsersLibModule } from '@app/users';

@Module({
  imports: [UsersLibModule],
  controllers: [UsersController],
})
export class UsersModule {}
