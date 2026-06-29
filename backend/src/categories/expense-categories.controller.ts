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
  UseGuards,
} from '@nestjs/common';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { ExpenseCategoriesService } from './expense-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(
    private readonly expenseCategoriesService: ExpenseCategoriesService,
  ) {}

  @Get()
  findAll() {
    return this.expenseCategoriesService.findAll();
  }

  @Get('archived')
  findArchived() {
    return this.expenseCategoriesService.findArchived();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expenseCategoriesService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateExpenseCategoryDto,
  ) {
    return this.expenseCategoriesService.update(id, body);
  }

  @Patch(':id/archive')
  archive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expenseCategoriesService.archive(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expenseCategoriesService.restore(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expenseCategoriesService.remove(id);
  }
}
