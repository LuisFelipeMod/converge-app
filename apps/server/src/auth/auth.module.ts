import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { WsAuthGuard } from './ws-auth.guard';

@Module({
  providers: [AuthGuard, WsAuthGuard],
  exports: [AuthGuard, WsAuthGuard],
})
export class AuthModule {}
