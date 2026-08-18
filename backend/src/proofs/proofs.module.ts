import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import { ProofsController } from './proofs.controller';
import { ProofsService } from './proofs.service';
import { AuthModule } from '../auth/auth.module';
import { getTmpUploadDir } from './proofs-paths';
import { getProofUploadMaxBytes } from './proofs-upload';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: getProofUploadMaxBytes(
            configService.get<string>('PROOF_UPLOAD_MAX_BYTES'),
          ),
        },
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            const tmpUploadDir = getTmpUploadDir();
            mkdirSync(tmpUploadDir, { recursive: true });
            callback(null, tmpUploadDir);
          },
          filename: (_request, _file, callback) => {
            callback(null, randomUUID());
          },
        }),
      }),
    }),
  ],
  controllers: [ProofsController],
  providers: [ProofsService],
  exports: [ProofsService],
})
export class ProofsModule {}
