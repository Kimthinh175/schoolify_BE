import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { PrismaService } from '../../database/prisma.service';

describe('NewsModule (Unit Tests)', () => {
  let controller: NewsController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      newsCategory: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cat-1', name: 'Tuyển sinh', slug: 'tuyen-sinh', _count: { articles: 1 } },
        ]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      newsArticle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'art-1',
            title: 'Kỳ thi THPT Quốc gia 2026',
            slug: 'ky-thi-thpt-2026',
            excerpt: 'Thông tin mới nhất về kỳ thi',
            tags: ['THPT'],
            search_text: 'ky thi thpt quoc gia 2026',
            status: 'PUBLISHED',
          },
        ]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [NewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<NewsController>(NewsController);
  });

  it('lists categories with article count', async () => {
    const res = await controller.listCategories('true');
    expect(res.success).toBe(true);
    expect(res.data[0].articles_count).toBe(1);
  });

  it('filters articles with Vietnamese accent-insensitive search', async () => {
    const res = await controller.listArticles('true', undefined, undefined, undefined, 'quoc gia');
    expect(res.data).toHaveLength(1);
  });

  it('throws NotFoundException when article slug does not exist', async () => {
    prisma.newsArticle.findFirst.mockResolvedValue(null);
    await expect(controller.getArticle('missing-slug', 'true')).rejects.toThrow(
      NotFoundException,
    );
  });
});
