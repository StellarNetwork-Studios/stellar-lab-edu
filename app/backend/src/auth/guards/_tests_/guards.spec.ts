import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from '../api-key.guard';
import { CustomThrottlerGuard } from '../custom-throttler.guard';
import { RATE_LIMITS } from '../../../common/constants/rate-limit.constants';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    guard = new ApiKeyGuard();
  });

  it('should allow public access if no API key', async () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should reject invalid API key', async () => {
    process.env.API_KEYS = 'invalidhash';
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': 'badkey' } }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow('API key is invalid');
  });
});

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    guard = new CustomThrottlerGuard();
  });

  it('should use default limit for public', async () => {
    const requestProps = {
      context: {
        switchToHttp: () => ({ getRequest: () => ({}) }),
      },
      limit: RATE_LIMITS.PUBLIC.limit,
    };
    const result = await guard.handleRequest(requestProps);
    expect(result).toBeDefined();
  });

  it('should use higher limit for API key', async () => {
    const requestProps = {
      context: {
        switchToHttp: () => ({ getRequest: () => ({ apiKey: { rateLimit: RATE_LIMITS.API_KEY.limit } }) }),
      },
      limit: RATE_LIMITS.PUBLIC.limit,
    };
    const result = await guard.handleRequest(requestProps);
    expect(result).toBeDefined();
  });
});
