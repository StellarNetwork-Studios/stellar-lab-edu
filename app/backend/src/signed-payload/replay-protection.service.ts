import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ReplayProtectionService {
  private readonly logger = new Logger(ReplayProtectionService.name);
  private readonly usedSignatures = new Set<string>();
  private readonly maxEntries = 10000;

  addSignature(signature: string): void {
    if (this.usedSignatures.size >= this.maxEntries) {
      this.usedSignatures.clear();
      this.logger.warn('Replay cache cleared due to size limit');
    }
    this.usedSignatures.add(signature);
  }

  isReplay(signature: string): boolean {
    return this.usedSignatures.has(signature);
  }

  clearExpired(oldestAllowedMs: number): void {
    this.logger.debug(`Replay protection cache size before: ${this.usedSignatures.size}`);
  }
}