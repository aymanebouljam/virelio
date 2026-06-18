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
import { ProofsService } from './proofs.service';

@Controller('expenses/:expenseId/proofs')
export class ProofsController {
  constructor(private readonly proofsService: ProofsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
