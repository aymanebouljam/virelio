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
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRecurringExpenseTemplateDto } from './dto/create-recurring-expense-template.dto';
import { GetRecurringExpenseTemplatesQueryDto } from './dto/get-recurring-expense-templates-query.dto';
import { UpdateRecurringExpenseTemplateDto } from './dto/update-recurring-expense-template.dto';
import { RecurringExpenseTemplatesService } from './recurring-expense-templates.service';

@UseGuards(JwtAuthGuard)
@Controller('recurring-expenses')
export class RecurringExpenseTemplatesController {
  constructor(
    private readonly recurringExpenseTemplatesService: RecurringExpenseTemplatesService,
  ) {}

  @Get()
  findPage(
    @CurrentUser() user: JwtUser,
    @Query() query: GetRecurringExpenseTemplatesQueryDto,
  ) {
    return this.recurringExpenseTemplatesService.findPage(user.sub, query);
  }

  @Get('archived')
  findArchived(@CurrentUser() user: JwtUser) {
    return this.recurringExpenseTemplatesService.findArchived(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpenseTemplatesService.findOne(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: CreateRecurringExpenseTemplateDto,
  ) {
    return this.recurringExpenseTemplatesService.create(user.sub, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateRecurringExpenseTemplateDto,
  ) {
    return this.recurringExpenseTemplatesService.update(user.sub, id, body);
  }

  @Patch(':id/archive')
  archive(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpenseTemplatesService.archive(user.sub, id);
  }

  @Patch(':id/restore')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpenseTemplatesService.restore(user.sub, id);
  }

  @Post(':id/generate')
  generateDueExpense(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpenseTemplatesService.generateDueExpense(
      user.sub,
      id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.recurringExpenseTemplatesService.remove(user.sub, id);
  }
}
