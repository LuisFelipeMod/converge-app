import { Module, DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { WsAuthGuard } from './ws-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        UserModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get<string>('JWT_SECRET', 'dev-secret'),
            signOptions: { expiresIn: '7d' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtAuthGuard,
        WsAuthGuard,
        JwtStrategy,
        {
          provide: GoogleStrategy,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const clientID = config.get<string>('GOOGLE_CLIENT_ID');
            if (!clientID) return null;
            return new GoogleStrategy(config);
          },
        },
        {
          provide: GithubStrategy,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const clientID = config.get<string>('GITHUB_CLIENT_ID');
            if (!clientID) return null;
            return new GithubStrategy(config);
          },
        },
      ],
      exports: [AuthService, JwtAuthGuard, WsAuthGuard],
    };
  }
}
