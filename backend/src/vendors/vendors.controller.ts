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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { VendorsService } from './vendors.service';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/auth.types';
import { GetVendorsQueryDto } from './dto/get-vendors-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: GetVendorsQueryDto) {
    return this.vendorsService.findAll(user.sub, query);
  }

  @Get('archived')
  findArchived(@CurrentUser() user: JwtUser) {
    return this.vendorsService.findArchived(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.vendorsService.findOne(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateVendorDto) {
    return this.vendorsService.create(user.sub, body);
  }

  @Patch(':id/archive')
  archive(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.vendorsService.archive(user.sub, id);
  }

  @Patch(':id/restore')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.vendorsService.restore(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateVendorDto,
  ) {
    return this.vendorsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.vendorsService.remove(user.sub, id);
  }
}
