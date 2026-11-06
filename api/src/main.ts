import {
  Logger as NestLogger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { formatValidationErrors } from './common/validation/format-validation-errors';
import { ValidationFailedException } from './common/exceptions/validation-failed.exception';
import type { EnvConfig } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);

  app.setGlobalPrefix('api', { exclude: [] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  await app.register(helmet);
  await app.register(compress);

  app.enableCors({
    origin: config.getOrThrow('CORS_ORIGINS', { infer: true }).split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
      exceptionFactory: (errors) =>
        new ValidationFailedException(formatValidationErrors(errors)),
    }),
  );

  if (config.getOrThrow('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Skolopals API')
        .setDescription('Backend API for Skolopals tutoring centre.')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = config.getOrThrow('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  new NestLogger('Bootstrap').log(`Skolopals API listening on port ${port}`);
}

void bootstrap();
