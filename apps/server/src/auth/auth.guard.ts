import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) return false;

    try {
      const payload = this.verifySimpleToken(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  verifySimpleToken(token: string): { userId: string; name: string } {
    const secret = this.config.get<string>('JWT_SECRET', 'dev-secret');
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) throw new Error('Invalid token format');

    const expectedSig = createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    if (signature !== expectedSig) throw new Error('Invalid signature');

    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  }
}
