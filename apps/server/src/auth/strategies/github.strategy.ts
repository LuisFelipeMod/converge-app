import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID', ''),
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET', ''),
      callbackURL: config.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:3000/auth/github/callback',
      ),
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ) {
    const user = {
      provider: 'github',
      providerId: String(profile.id),
      email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
      name: profile.displayName || profile.username || '',
      avatar: profile.photos?.[0]?.value || null,
    };
    done(null, user);
  }
}
