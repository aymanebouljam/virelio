import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { VendorsService } from './vendors.service';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // GET
  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get('archived')
  findArchived() {
    return this.vendorsService.findArchived();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vendorsService.findOne(id);
  }
  // POST

  @Post()
  create(@Body() body: CreateVendorDto) {
    return this.vendorsService.create(body);
  }
  // PATCH
  @Patch(':id/archive')
  archive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vendorsService.archive(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vendorsService.restore(id);
  }
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateVendorDto,
  ) {
    return this.vendorsService.update(id, body);
  }

  // Delete
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vendorsService.remove(id);
  }
}
