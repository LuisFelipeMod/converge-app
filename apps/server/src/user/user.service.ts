import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findOrCreate(profile: OAuthProfile) {
    const existing = await this.prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: profile.name,
          avatar: profile.avatar,
          email: profile.email,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        provider: profile.provider,
        providerId: profile.providerId,
      },
    });
  }
}
