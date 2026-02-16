import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DocumentModule } from './document/document.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CollaborationModule,
    DocumentModule,
  ],
})
export class AppModule {}
