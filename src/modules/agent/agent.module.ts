import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { SemanticCheckpointService } from './services/semantic-checkpoint.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { AntigravityIpcBridgeService } from './services/antigravity-ipc-bridge.service';

@Module({
  controllers: [AgentController],
  providers: [
    SemanticCheckpointService,
    SemanticCacheService,
    AntigravityIpcBridgeService,
  ],
  exports: [
    SemanticCheckpointService,
    SemanticCacheService,
    AntigravityIpcBridgeService,
  ],
})
export class AgentModule {}
