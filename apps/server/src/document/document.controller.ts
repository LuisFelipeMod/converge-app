import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Get()
  findAll() {
    return this.documentService.findAll();
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

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.documentService.delete(id);
  }
}
