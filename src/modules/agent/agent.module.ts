import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { SemanticCheckpointService } from './services/semantic-checkpoint.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { AntigravityIpcBridgeService } from './services/antigravity-ipc-bridge.service';
import { DocxExamGeneratorService } from './services/docx-exam-generator.service';
import { ChatMemoryService } from './services/chat-memory.service';

@Module({
  controllers: [AgentController],
  providers: [
    SemanticCheckpointService,
    SemanticCacheService,
    AntigravityIpcBridgeService,
    DocxExamGeneratorService,
    ChatMemoryService,
  ],
  exports: [
    SemanticCheckpointService,
    SemanticCacheService,
    AntigravityIpcBridgeService,
    DocxExamGeneratorService,
    ChatMemoryService,
  ],
})
export class AgentModule {}
