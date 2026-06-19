import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getUploadsRoot } from './proofs/proofs-paths';

export function configureApp(app: NestExpressApplication) {
  const configService = app.get(ConfigService);
  const frontendOrigin = configService.getOrThrow<string>('FRONTEND_ORIGIN');

  app.enableCors({
    origin: [frontendOrigin],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException({
          message: 'Validation failed',
          errors: errors.map((error) => ({
            field: error.property,
            constraints: error.constraints ?? {},
          })),
        });
      },
    }),
  );

  app.useStaticAssets(getUploadsRoot(), {
    prefix: '/uploads',
  });
}
