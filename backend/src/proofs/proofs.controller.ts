import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { ProofsService } from './proofs.service';
import { getTmpUploadDir } from './proofs-paths';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/auth.types';

function buildStoredFilename(originalName: string) {
  const extension = extname(originalName);
  return `${randomUUID()}${extension}`;
}

@UseGuards(JwtAuthGuard)
@Controller('expenses/:expenseId/proofs')
export class ProofsController {
  constructor(private readonly proofsService: ProofsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const tmpUploadDir = getTmpUploadDir();
          mkdirSync(tmpUploadDir, { recursive: true });
          callback(null, tmpUploadDir);
        },
        filename: (_req, file, callback) => {
          callback(null, buildStoredFilename(file.originalname));
        },
      }),
    }),
  )
  uploadProof(
    @CurrentUser() user: JwtUser,
    @Param('expenseId', new ParseUUIDPipe({ version: '4' })) expenseId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'file',
            constraints: {
              isDefined: 'A proof file is required',
            },
          },
        ],
      });
    }

    return this.proofsService.upload(user.sub, expenseId, file);
  }

  @Delete(':proofId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProof(
    @CurrentUser() user: JwtUser,
    @Param('expenseId', new ParseUUIDPipe({ version: '4' })) expenseId: string,
    @Param('proofId', new ParseUUIDPipe({ version: '4' })) proofId: string,
  ) {
    return this.proofsService.remove(user.sub, expenseId, proofId);
  }
}
