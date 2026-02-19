import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../sharing/sharing.service';

@Injectable()
export class DocumentService {
  constructor(
    private prisma: PrismaService,
    private sharingService: SharingService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.document.findMany({
      where: {
        archived: { not: true },
        OR: [
          { ownerId: userId },
          { ownerId: null },
          { shares: { some: { sharedWithId: userId, status: 'ACCEPTED' } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
      },
    });
  }

  async findArchived(userId: string) {
    return this.prisma.document.findMany({
      where: {
        archived: true,
        OR: [
          { ownerId: userId },
          { ownerId: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
      },
    });
  }

  async findById(id: string, userId: string) {
    const hasAccess = await this.sharingService.canAccessDocument(id, userId);
    if (!hasAccess) throw new ForbiddenException('Access denied');
    return this.prisma.document.findUnique({ where: { id } });
  }

  async create(name: string, ownerId: string | null) {
    return this.prisma.document.create({
      data: { name, ownerId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private async assertOwnership(id: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== null && doc.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can perform this action');
    }
  }

  async archive(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.document.update({ where: { id }, data: { archived: true } });
  }

  async unarchive(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.document.update({ where: { id }, data: { archived: false } });
  }

  async delete(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.document.delete({ where: { id } });
  }
}
