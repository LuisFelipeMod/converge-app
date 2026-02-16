import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DocumentModule } from './document/document.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '..', '.env'),
    }),
    PrismaModule,
    UserModule,
    AuthModule.forRoot(),
    CollaborationModule,
    DocumentModule,
  ],
})
export class AppModule {}
