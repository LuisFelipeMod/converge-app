import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.document.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async findById(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  async create(name: string) {
    return this.prisma.document.create({ data: { name } });
  }

  async delete(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }
}
