import {
  BadRequestException,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { ProofsService } from './proofs.service';
import { getTmpUploadDir } from './proofs-paths';

function buildStoredFilename(originalName: string) {
  const extension = extname(originalName);
  return `${randomUUID()}${extension}`;
}

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

    return this.proofsService.upload(expenseId, file);
  }
}
