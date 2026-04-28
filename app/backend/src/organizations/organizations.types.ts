/**
 * Organization and membership related types and enums
 */

export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/**
 * Role permissions matrix
 * Defines what actions each role can perform
 */
export const ROLE_PERMISSIONS: Record<OrganizationRole, Set<string>> = {
  OWNER: new Set([
    'org:read',
    'org:write',
    'org:delete',
    'members:read',
    'members:write',
    'members:delete',
    'members:invite',
    'api-keys:read',
    'api-keys:write',
    'api-keys:delete',
    'links:read',
    'links:write',
    'links:delete',
    'transactions:read',
    'webhooks:read',
    'webhooks:write',
    'webhooks:delete',
  ]),
  ADMIN: new Set([
    'org:read',
    'org:write',
    'members:read',
    'members:write',
    'members:invite',
    'api-keys:read',
    'api-keys:write',
    'api-keys:delete',
    'links:read',
    'links:write',
    'transactions:read',
    'webhooks:read',
    'webhooks:write',
  ]),
  MEMBER: new Set([
    'org:read',
    'members:read',
    'api-keys:read',
    'api-keys:write',
    'links:read',
    'links:write',
    'transactions:read',
    'webhooks:read',
  ]),
  VIEWER: new Set(['org:read', 'members:read', 'api-keys:read', 'links:read', 'transactions:read']),
};

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  invited_at?: string;
  invited_by?: string;
  accepted_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
}

/**
 * Request context attached to the HTTP request object
 * Contains organization and membership information for the authenticated user
 */
export interface OrganizationContext {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  permissions: Set<string>;
}
