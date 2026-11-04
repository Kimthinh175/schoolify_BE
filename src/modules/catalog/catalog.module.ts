import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PayOSService } from './payos.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, PayOSService, PrismaService],
  exports: [CatalogService, PayOSService],
})
export class CatalogModule {}

