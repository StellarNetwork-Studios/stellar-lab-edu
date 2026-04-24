import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '../api-keys.types';

export const API_KEY_SCOPES_KEY = 'api_key_scopes';

/** Decorator to specify required scopes for an API endpoint. */
export const Scopes = (...scopes: ApiKeyScope[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);