import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { AuthModule } from '../auth/auth.module';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [AuthModule.forRoot(), SharingModule],
  providers: [CollaborationGateway, CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
