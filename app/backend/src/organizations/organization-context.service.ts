import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiKeyRecord } from '../api-keys/api-keys.types';

@Injectable()
export class OrganizationContextService {
  private logger = new Logger(OrganizationContextService.name);
  private supabase: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Extract organization ID from an API key
   * @param apiKeyRecord The API key database record
   * @returns Organization ID or null if not set
   */
  async getApiKeyOrganization(apiKeyRecord: ApiKeyRecord): Promise<string | null> {
    if (apiKeyRecord.organization_id) {
      return apiKeyRecord.organization_id;
    }

    // For legacy API keys without organization_id, use owner's default org
    if (apiKeyRecord.owner_id) {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', apiKeyRecord.owner_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        this.logger.error('Failed to get organization for API key owner', {
          apiKeyId: apiKeyRecord.id,
          ownerId: apiKeyRecord.owner_id,
          error: error.message,
        });
        return null;
      }

      return data?.id || null;
    }

    return null;
  }

  /**
   * Get user ID from API key owner
   * @param apiKeyRecord The API key database record
   * @returns User ID (Stellar public key)
   */
  getUserFromApiKey(apiKeyRecord: ApiKeyRecord): string | null {
    return apiKeyRecord.owner_id || null;
  }

  /**
   * Validate that an API key has access to a specific organization
   * @param organizationId Organization ID to check
   * @param apiKeyOrganization Organization ID associated with the API key
   * @returns true if API key can access the organization
   */
  canAccessOrganization(organizationId: string, apiKeyOrganization: string | null): boolean {
    if (!apiKeyOrganization) {
      return false;
    }

    return organizationId === apiKeyOrganization;
  }
}
