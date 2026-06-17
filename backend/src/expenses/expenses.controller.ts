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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll() {
    return this.expensesService.findAll();
  }

  @Get('archived')
  findArchived() {
    return this.expensesService.findArchived();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateExpenseDto) {
    return this.expensesService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, body);
  }

  @Patch(':id/archive')
  archive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expensesService.archive(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expensesService.restore(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expensesService.remove(id);
  }
}
