import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConversationsController } from './conversations.controller';
import { ConversationsGateway } from './conversations.gateway';
import { ConversationsModule as ConversationsLibModule } from '@app/conversations';

@Module({
  imports: [
    ConversationsLibModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' },
    }),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsGateway],
})
export class ConversationsModule {}
