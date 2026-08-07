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
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { GetExpenseCategoriesPageQueryDto } from './dto/get-expense-categories-page-query.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { ExpenseCategoriesService } from './expense-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard)
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(
    private readonly expenseCategoriesService: ExpenseCategoriesService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    return this.expenseCategoriesService.findAll(user.sub);
  }

  @Get('page')
  findPage(
    @CurrentUser() user: JwtUser,
    @Query() query: GetExpenseCategoriesPageQueryDto,
  ) {
    return this.expenseCategoriesService.findPage(user.sub, query);
  }

  @Get('archived')
  findArchived(@CurrentUser() user: JwtUser) {
    return this.expenseCategoriesService.findArchived(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expenseCategoriesService.findOne(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(user.sub, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateExpenseCategoryDto,
  ) {
    return this.expenseCategoriesService.update(user.sub, id, body);
  }

  @Patch(':id/archive')
  archive(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expenseCategoriesService.archive(user.sub, id);
  }

  @Patch(':id/restore')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expenseCategoriesService.restore(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.expenseCategoriesService.remove(user.sub, id);
  }
}
