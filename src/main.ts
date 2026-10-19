import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable Cookie Parser for reading HTTP-Only cookies
  app.use(cookieParser());

  // 2. Enable CORS with credentials for Next.js Frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
  await app.listen(port);
  console.log(`🚀 Schoolify Backend is running on http://localhost:${port}`);
  console.log(`📚 Swagger API Docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
