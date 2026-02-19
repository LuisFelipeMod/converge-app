import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SharingService } from './sharing.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private sharingService: SharingService) {}

  // ─── Email Invitations ─────────────────────────────────────

  @Post('documents/:id/shares')
  inviteByEmail(
    @Param('id') documentId: string,
    @Body('email') email: string,
    @Req() req: any,
  ) {
    return this.sharingService.inviteByEmail(documentId, req.user.userId, email);
  }

  @Get('documents/:id/shares')
  getDocumentShares(@Param('id') documentId: string, @Req() req: any) {
    return this.sharingService.getDocumentShares(documentId, req.user.userId);
  }

  @Delete('shares/:shareId')
  removeShare(@Param('shareId') shareId: string, @Req() req: any) {
    return this.sharingService.removeShare(shareId, req.user.userId);
  }

  // ─── My Invitations ────────────────────────────────────────

  @Get('invitations')
  getPendingInvites(@Req() req: any) {
    return this.sharingService.getPendingInvites(req.user.userId);
  }

  @Post('invitations/:shareId/accept')
  acceptInvite(@Param('shareId') shareId: string, @Req() req: any) {
    return this.sharingService.acceptInvite(shareId, req.user.userId);
  }

  @Post('invitations/:shareId/decline')
  declineInvite(@Param('shareId') shareId: string, @Req() req: any) {
    return this.sharingService.declineInvite(shareId, req.user.userId);
  }

  // ─── Share Links ───────────────────────────────────────────

  @Post('documents/:id/share-link')
  createShareLink(@Param('id') documentId: string, @Req() req: any) {
    return this.sharingService.createShareLink(documentId, req.user.userId);
  }

  @Delete('share-links/:linkId')
  deactivateShareLink(@Param('linkId') linkId: string, @Req() req: any) {
    return this.sharingService.deactivateShareLink(linkId, req.user.userId);
  }

  @Get('share-links/:token')
  getShareLinkByToken(@Param('token') token: string) {
    return this.sharingService.getShareLinkByToken(token);
  }

  @Post('share-links/:token/accept')
  acceptShareLink(@Param('token') token: string, @Req() req: any) {
    return this.sharingService.acceptShareLink(token, req.user.userId);
  }
}
