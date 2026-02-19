import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.documentService.findAll(req.user.userId);
  }

  @Get('archived')
  findArchived(@Req() req: any) {
    return this.documentService.findArchived(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const doc = await this.documentService.findById(id, req.user.userId);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @Post()
  create(@Body('name') name: string, @Req() req: any) {
    const ownerId = req.user.guest ? null : req.user.userId;
    return this.documentService.create(name || 'Untitled', ownerId);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Req() req: any) {
    return this.documentService.archive(id, req.user.userId);
  }

  @Patch(':id/unarchive')
  unarchive(@Param('id') id: string, @Req() req: any) {
    return this.documentService.unarchive(id, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.documentService.delete(id, req.user.userId);
  }
}
