import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ReadinessCheckDto } from './readiness-check.dto';

@Injectable()
export class ReadinessService {
  private readonly REQUIRED_ENVS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];

  async runChecks(): Promise<ReadinessCheckDto[]> {
    const checks: ReadinessCheckDto[] = [];

    // 1. ENV CHECK
    const missing = this.REQUIRED_ENVS.filter(
      (env) => !process.env[env],
    );

    checks.push({
      name: 'env',
      ok: missing.length === 0,
      ...(missing.length && {
        error: `Missing envs: ${missing.join(', ')}`,
      }),
    });

    // 2. SUPABASE CHECK
    try {
      await this.withTimeout(this.pingSupabase(), 1000);
      checks.push({ name: 'supabase', ok: true });
    } catch (error: any) {
      checks.push({
        name: 'supabase',
        ok: false,
        error: error?.message ?? 'connection failed',
      });
    }

    return checks;
  }

  private async pingSupabase(): Promise<void> {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    await client.from('_health').select('*').limit(1);
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ms),
      ),
    ]);
  }
}
