import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SharingService {
  constructor(private prisma: PrismaService) {}

  async canAccessDocument(documentId: string, userId: string): Promise<boolean> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        ownerId: true,
        shares: {
          where: { sharedWithId: userId, status: 'ACCEPTED' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!doc) return false;
    // Legacy ownerless documents are accessible to everyone
    if (doc.ownerId === null) return true;
    if (doc.ownerId === userId) return true;
    if (doc.shares.length > 0) return true;
    return false;
  }

  private async assertOwnerOrClaim(documentId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { ownerId: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId === null) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { ownerId: userId },
      });
      return;
    }
    if (doc.ownerId !== userId) throw new ForbiddenException('Only the owner can share');
  }

  async inviteByEmail(documentId: string, ownerUserId: string, recipientEmail: string) {
    await this.assertOwnerOrClaim(documentId, ownerUserId);

    const recipient = await this.prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('User not found');
    if (recipient.id === ownerUserId) throw new ConflictException('Cannot share with yourself');

    const existing = await this.prisma.documentShare.findUnique({
      where: { documentId_sharedWithId: { documentId, sharedWithId: recipient.id } },
    });
    if (existing) throw new ConflictException('Already shared with this user');

    return this.prisma.documentShare.create({
      data: {
        documentId,
        sharedWithId: recipient.id,
        sharedById: ownerUserId,
      },
      include: {
        sharedWith: { select: { name: true, email: true } },
      },
    });
  }

  async acceptInvite(shareId: string, userId: string) {
    const share = await this.prisma.documentShare.findUnique({ where: { id: shareId } });
    if (!share) throw new NotFoundException('Invitation not found');
    if (share.sharedWithId !== userId) throw new ForbiddenException('Not your invitation');

    return this.prisma.documentShare.update({
      where: { id: shareId },
      data: { status: 'ACCEPTED' },
    });
  }

  async declineInvite(shareId: string, userId: string) {
    const share = await this.prisma.documentShare.findUnique({ where: { id: shareId } });
    if (!share) throw new NotFoundException('Invitation not found');
    if (share.sharedWithId !== userId) throw new ForbiddenException('Not your invitation');

    return this.prisma.documentShare.update({
      where: { id: shareId },
      data: { status: 'DECLINED' },
    });
  }

  async getPendingInvites(userId: string) {
    return this.prisma.documentShare.findMany({
      where: { sharedWithId: userId, status: 'PENDING' },
      include: {
        document: { select: { id: true, name: true } },
        sharedBy: { select: { name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentShares(documentId: string, ownerUserId: string) {
    await this.assertOwnerOrClaim(documentId, ownerUserId);

    return this.prisma.documentShare.findMany({
      where: { documentId },
      include: {
        sharedWith: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeShare(shareId: string, ownerUserId: string) {
    const share = await this.prisma.documentShare.findUnique({
      where: { id: shareId },
      include: { document: { select: { ownerId: true } } },
    });
    if (!share) throw new NotFoundException('Share not found');
    if (share.document.ownerId !== ownerUserId) throw new ForbiddenException('Only the owner can remove shares');

    return this.prisma.documentShare.delete({ where: { id: shareId } });
  }

  async createShareLink(documentId: string, ownerUserId: string) {
    await this.assertOwnerOrClaim(documentId, ownerUserId);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { ownerId: true, name: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const existing = await this.prisma.shareLink.findFirst({
      where: { documentId, active: true },
    });
    if (existing) {
      return { ...existing, documentName: doc.name };
    }

    const link = await this.prisma.shareLink.create({
      data: { documentId, createdById: ownerUserId },
    });
    return { ...link, documentName: doc.name };
  }

  async deactivateShareLink(linkId: string, ownerUserId: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { id: linkId },
      include: { document: { select: { ownerId: true } } },
    });
    if (!link) throw new NotFoundException('Share link not found');
    if (link.document.ownerId !== ownerUserId) throw new ForbiddenException('Only the owner can deactivate links');

    return this.prisma.shareLink.update({
      where: { id: linkId },
      data: { active: false },
    });
  }

  async getShareLinkByToken(token: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { document: { select: { id: true, name: true } } },
    });
    if (!link || !link.active) throw new NotFoundException('Share link not found or inactive');
    return link;
  }

  async acceptShareLink(token: string, userId: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { document: { select: { id: true, ownerId: true } } },
    });
    if (!link || !link.active) throw new NotFoundException('Share link not found or inactive');
    if (link.document.ownerId === userId) {
      return { alreadyOwner: true, documentId: link.documentId };
    }

    await this.prisma.documentShare.upsert({
      where: {
        documentId_sharedWithId: {
          documentId: link.documentId,
          sharedWithId: userId,
        },
      },
      create: {
        documentId: link.documentId,
        sharedWithId: userId,
        sharedById: link.createdById,
        status: 'ACCEPTED',
      },
      update: { status: 'ACCEPTED' },
    });

    return { alreadyOwner: false, documentId: link.documentId };
  }
}
