import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  // ─── Google OAuth ────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const token = await this.authService.validateOAuthLogin(req.user as any);
    const frontendUrl = this.config.get('CORS_ORIGIN', 'http://localhost:5173');
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  // ─── GitHub OAuth ────────────────────────────
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport redirects to GitHub
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const token = await this.authService.validateOAuthLogin(req.user as any);
    const frontendUrl = this.config.get('CORS_ORIGIN', 'http://localhost:5173');
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  // ─── Profile ─────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: Request) {
    return req.user;
  }

  // ─── Guest token (backwards compatible) ──────
  @Post('token')
  createGuestToken(@Body() body: { userId: string; name: string }) {
    const token = this.authService.generateGuestToken(body.userId, body.name);
    return { token };
  }
}
