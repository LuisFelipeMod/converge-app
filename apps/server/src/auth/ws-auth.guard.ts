import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private authGuard: AuthGuard) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.query?.token;

    if (!token) return false;

    try {
      const payload = this.authGuard.verifySimpleToken(token as string);
      client.data.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
