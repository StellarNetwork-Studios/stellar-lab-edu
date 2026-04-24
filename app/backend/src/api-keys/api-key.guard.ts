import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys.service';
import { ApiKeyScope } from '../api-keys.types';
import { API_KEY_SCOPES_KEY } from '../decorators/scopes.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private apiKeysService: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(API_KEY_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!rawKey) {
      throw new UnauthorizedException('API key is missing');
    }

    const result = await this.apiKeysService.validateKey(rawKey);
    if (!result) {
      throw new UnauthorizedException('Invalid API key');
    }

    const { record, hasScope } = result;

    if (this.apiKeysService.isOverQuota(record)) {
      throw new ForbiddenException('Monthly API usage quota exceeded');
    }

    if (requiredScopes && !requiredScopes.every((scope) => hasScope(scope))) {
      throw new ForbiddenException('API key does not have the required scopes');
    }

    request.apiKey = record;
    return true;
  }
}