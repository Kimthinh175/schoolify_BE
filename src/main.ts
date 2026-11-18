import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Tin cậy reverse proxy (Nginx/Plesk) để đọc đúng X-Forwarded-Proto / IP
  app.set('trust proxy', 1);

  // Phục vụ file ảnh tĩnh local (fallback khi chưa cấu hình Cloudinary)
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // 1. Enable Cookie Parser for reading HTTP-Only cookies
  app.use(cookieParser());

  // 2. Enable CORS with credentials for Next.js Frontend
  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://schoolify.top',
      'https://www.schoolify.top',
      'http://localhost:3000',
      'http://localhost:3050',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3050',
      ...extraOrigins,
    ],
    credentials: true,
  });

  // 3. Enable Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 4. Swagger API Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Schoolify API Documentation')
    .setDescription(
      'Schoolify SaaS Multi-tenant Education Platform API - Core Users, Schools, Courses, Exams, SaaS Billing',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'JWT Token lưu trong HTTP-Only Cookie "access_token"',
    })
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-school-id',
        in: 'header',
        description: 'School ID header cho các endpoint Multi-tenant RBAC',
      },
      'x-school-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
    customSiteTitle: 'Schoolify API Docs',
  });

  const port = process.env.PORT ?? 3001;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`🚀 Schoolify Backend is running on http://localhost:${port}`);
  console.log(
    `📚 Swagger API Docs available at http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
