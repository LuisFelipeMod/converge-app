import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService, OAuthProfile } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async validateOAuthLogin(profile: OAuthProfile) {
    const user = await this.userService.findOrCreate(profile);
    return this.generateToken(user);
  }

  generateToken(user: { id: string; email: string; name: string; avatar?: string | null }) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || null,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Anonymous token for guest users (backwards compatible)
   */
  generateGuestToken(userId: string, name: string) {
    const payload = {
      sub: userId,
      email: null,
      name,
      avatar: null,
      guest: true,
    };
    return this.jwtService.sign(payload);
  }

  verifyToken(token: string) {
    return this.jwtService.verify(token);
  }
}
