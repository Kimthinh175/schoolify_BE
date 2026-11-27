import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { SemanticCacheService } from './services/semantic-cache.service';
import { AgentController } from './agent.controller';
import { SemanticCheckpointService } from './services/semantic-checkpoint.service';
import { AntigravityIpcBridgeService } from './services/antigravity-ipc-bridge.service';
import { DocxExamGeneratorService } from './services/docx-exam-generator.service';
import { ChatMemoryService } from './services/chat-memory.service';
import { PrismaService } from '../../database/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('AgentModule & SemanticCache (Unit Tests)', () => {
  describe('SemanticCacheService', () => {
    let cacheService: SemanticCacheService;
    let prisma: any;

    beforeEach(async () => {
      prisma = {
        semanticCache: {
          findMany: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
          count: jest.fn().mockResolvedValue(2),
        },
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SemanticCacheService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      cacheService = module.get<SemanticCacheService>(SemanticCacheService);
    });

    it('keeps unrelated short queries below 0.70 cosine similarity while matching identical/paraphrased queries', async () => {
      const vMath1 = await cacheService.getEmbedding('Cách giải phương trình bậc hai');
      const vMath2 = await cacheService.getEmbedding('Cách giải phương trình bậc hai');
      const vEng = await cacheService.getEmbedding('Cấu trúc câu bị động tiếng Anh');

      expect(cacheService.cosineSimilarity(vMath1, vMath2)).toBeGreaterThan(0.99);
      expect(cacheService.cosineSimilarity(vMath1, vEng)).toBeLessThan(0.7);
    });

    it('ignores expired cache entries whose created_at exceeded ttl_days', async () => {
      const vec = await cacheService.getEmbedding('Giải hệ phương trình bậc nhất hai ẩn');
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      prisma.semanticCache.findMany.mockResolvedValueOnce([
        {
          id: 'expired-entry',
          query_text: 'Giải hệ phương trình bậc nhất hai ẩn',
          query_vector: vec,
          response_text: 'Old cached answer',
          client_actions: [],
          ttl_days: 7,
          created_at: tenDaysAgo,
        },
      ]);

      const res = await cacheService.findInCache('Giải hệ phương trình bậc nhất hai ẩn');
      expect(res.hit).toBe(false);
      expect(prisma.semanticCache.update).not.toHaveBeenCalled();
    });

    it('returns cache HIT and increments hit_count for fresh matching entry', async () => {
      const vec = await cacheService.getEmbedding('Định lý Vi-ét phương trình bậc hai');
      prisma.semanticCache.findMany.mockResolvedValueOnce([
        {
          id: 'fresh-entry',
          query_text: 'Định lý Vi-ét phương trình bậc hai',
          query_vector: vec,
          response_text: 'Tổng hai nghiệm x1+x2 = -b/a',
          client_actions: [],
          ttl_days: 7,
          created_at: new Date(),
        },
      ]);

      const res = await cacheService.findInCache('Định lý Vi-ét phương trình bậc hai');
      expect(res.hit).toBe(true);
      expect(res.responseText).toContain('-b/a');
      expect(prisma.semanticCache.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fresh-entry' } }),
      );
    });
  });

  describe('AgentController Guards, Billing & Cache Isolation', () => {
    let controller: AgentController;
    let prisma: any;
    let cacheService: jest.Mocked<Partial<SemanticCacheService>>;
    let ipcBridgeService: jest.Mocked<Partial<AntigravityIpcBridgeService>>;
    let chatMemoryService: jest.Mocked<Partial<ChatMemoryService>>;

    beforeEach(async () => {
      prisma = {
        studentProfile: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
        examPointLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      cacheService = {
        findInCache: jest.fn().mockResolvedValue({ hit: false }),
        saveToCache: jest.fn().mockResolvedValue(undefined),
        getStats: jest.fn().mockResolvedValue({ totalEntries: 0, topHits: [] }),
      };
      ipcBridgeService = {
        generateAgentResponse: jest.fn().mockResolvedValue({
          message: 'Lời giải chi tiết bằng KaTeX $x=1$.',
          actions: [],
          emotion: 'idea',
          suggestions: [],
          usageMetadata: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
        }),
      };
      chatMemoryService = {
        getSession: jest.fn().mockResolvedValue([]),
        buildVectorizedContext: jest.fn().mockResolvedValue({
          hotWindow: [],
          recalledTurns: [],
          contextSummary: '',
          instantMemoryHit: undefined,
          stats: {
            totalHistoricalTurnsScanned: 0,
            recalledCount: 0,
            tokenSavedPercent: 0,
            vectorComputeMs: 1,
          },
        }),
        saveSession: jest.fn().mockResolvedValue(null),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AgentController],
        providers: [
          { provide: SemanticCheckpointService, useValue: { evaluate: jest.fn() } },
          { provide: SemanticCacheService, useValue: cacheService },
          { provide: AntigravityIpcBridgeService, useValue: ipcBridgeService },
          {
            provide: DocxExamGeneratorService,
            useValue: {
              scanAndGenerateFromDocx: jest.fn(),
              checkQuestionsDuplicates: jest.fn(),
              saveGeneratedQuestionsToBank: jest.fn(),
            },
          },
          { provide: ChatMemoryService, useValue: chatMemoryService },
          { provide: PrismaService, useValue: prisma },
          Reflector,
          RolesGuard,
        ],
      }).compile();

      controller = module.get<AgentController>(AgentController);
    });

    it('restricts docx-save-to-bank, docx-scan-generate, docx-check-duplicates, and cache-stats to SUPER_ADMIN', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      for (const methodName of [
        'scanAndGenerateFromDocx',
        'checkDocxQuestionsDuplicates',
        'saveDocxQuestionsToBank',
        'getCacheStats',
      ] as const) {
        const handler = (AgentController.prototype as any)[methodName];
        const roles = reflector.getAllAndOverride(ROLES_KEY, [handler, AgentController]);
        expect(roles).toEqual([SystemRole.SUPER_ADMIN]);

        const mockUserCtx: any = {
          getHandler: () => handler,
          getClass: () => AgentController,
          switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', role: SystemRole.USER } }) }),
        };
        expect(() => rolesGuard.canActivate(mockUserCtx)).toThrow(ForbiddenException);
      }
    });

    it('blocks academic query when authenticated student has 0 Diamonds', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-0',
        user_id: 'u-0',
        points: 0,
        active_package: 'FREE',
      });

      const res: any = await controller.chatWithAgent(
        { message: 'Giải giúp tớ phương trình x^2 - 5x + 6 = 0' } as any,
        { id: 'u-0', role: 'USER' },
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('INSUFFICIENT_XIN_POINTS');
    });

    it('skips global SemanticCache when questionContext or history is present (prevents context bleed)', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-1',
        user_id: 'u-1',
        points: 10,
        active_package: 'FREE',
      });

      await controller.chatWithAgent(
        {
          message: 'Giải thích kỹ hơn bước trên cho tớ với',
          history: [{ role: 'user', content: 'Bài toán hình học Oxyz...' }],
        } as any,
        { id: 'u-1', role: 'USER' },
      );

      expect(cacheService.findInCache).not.toHaveBeenCalled();
      expect(cacheService.saveToCache).not.toHaveBeenCalled();
    });
  });

  describe('AntigravityIpcBridgeService env-configured Gemini model', () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origModel = process.env.GEMINI_MODEL;
    const origFallbacks = process.env.GEMINI_FALLBACK_MODELS;
    const origFetch = global.fetch;

    afterEach(() => {
      process.env.GEMINI_API_KEY = origKey;
      process.env.GEMINI_MODEL = origModel;
      process.env.GEMINI_FALLBACK_MODELS = origFallbacks;
      global.fetch = origFetch;
      jest.restoreAllMocks();
    });

    it('reads GEMINI_MODEL from env with thinkingLevel LOW and strips thought parts', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      process.env.GEMINI_MODEL = 'gemini-3.8-flash';
      process.env.GEMINI_FALLBACK_MODELS = 'gemini-2.5-flash,gemini-flash-latest';

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'Internal reasoning should not leak' },
                  { text: 'Phương trình $x^2 - 5x + 6 = 0$ có nghiệm $x = 2$ hoặc $x = 3$.' },
                ],
              },
            },
          ],
          usageMetadata: { candidatesTokenCount: 42 },
        }),
      });
      global.fetch = fetchMock as any;

      const bridge = new AntigravityIpcBridgeService();
      const result = await bridge.generateAgentResponse(
        { message: 'Giải phương trình x^2 - 5x + 6 = 0' } as any,
        { allowRealAi: true },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/models/gemini-3.8-flash:generateContent');
      const body = JSON.parse(calledInit.body);
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(body.generationConfig.thinkingConfig.thinkingBudget).toBeUndefined();
      expect(result.message).toBe('Phương trình $x^2 - 5x + 6 = 0$ có nghiệm $x = 2$ hoặc $x = 3$.');
      expect(result.message).not.toContain('Internal reasoning');
    });

    it('falls back to GEMINI_FALLBACK_MODELS with thinkingBudget 0 when primary fails', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      process.env.GEMINI_MODEL = 'gemini-3.8-flash';
      process.env.GEMINI_FALLBACK_MODELS = 'gemini-2.5-flash';

      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Model overloaded',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Fallback ok' }] } }],
          }),
        });
      global.fetch = fetchMock as any;

      const bridge = new AntigravityIpcBridgeService();
      const result = await bridge.generateAgentResponse(
        { message: 'Tính đạo hàm của x^3' } as any,
        { allowRealAi: true },
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-3.8-flash:generateContent');
      expect(fetchMock.mock.calls[1][0]).toContain('/models/gemini-2.5-flash:generateContent');
      const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(fallbackBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(result.message).toBe('Fallback ok');
    });

    it('does not call Gemini API if GEMINI_MODEL and GEMINI_FALLBACK_MODELS are both unset', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      delete process.env.GEMINI_MODEL;
      delete process.env.GEMINI_FALLBACK_MODELS;

      const fetchMock = jest.fn();
      global.fetch = fetchMock as any;

      const bridge = new AntigravityIpcBridgeService();
      await bridge.generateAgentResponse(
        { message: 'Giải giúp tớ bài toán này' } as any,
        { allowRealAi: true },
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
