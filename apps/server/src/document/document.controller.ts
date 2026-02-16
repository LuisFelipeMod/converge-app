import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
  findAll() {
    return this.documentService.findAll();
  }

  @Get('archived')
  findArchived() {
    return this.documentService.findArchived();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const doc = await this.documentService.findById(id);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @Post()
  create(@Body('name') name: string) {
    return this.documentService.create(name || 'Untitled');
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.documentService.archive(id);
  }

  @Patch(':id/unarchive')
  unarchive(@Param('id') id: string) {
    return this.documentService.unarchive(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.documentService.delete(id);
  }
}
