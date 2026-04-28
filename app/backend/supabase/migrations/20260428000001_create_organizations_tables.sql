-- =============================================================================
-- Multi-Tenant Organizations Support
-- =============================================================================
-- Introduces logical isolation between organizations. Each organization has:
-- - Ownership by a primary user (stellar public key)
-- - Members with role-based access control (OWNER, ADMIN, MEMBER, VIEWER)
-- - Workspace context for API keys and resources
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT         NOT NULL,
  slug            TEXT         NOT NULL,                -- URL-friendly identifier
  description     TEXT,
  owner_id        TEXT         NOT NULL,               -- Stellar public key of owner
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Unique slug per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);

-- Index for listing organizations by owner
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations (owner_id);

-- Index for active organizations
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations (is_active);

COMMENT ON TABLE organizations IS 'Multi-tenant organizations. Each org has members with roles.';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier for the organization.';
COMMENT ON COLUMN organizations.owner_id IS 'Stellar public key of the primary owner.';

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
-- Role-based access control for organization members.
-- Roles: OWNER (all permissions), ADMIN (manage members), MEMBER (standard), VIEWER (read-only)

CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id         TEXT         NOT NULL,               -- Stellar public key or email
  role            TEXT         NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, MEMBER, VIEWER
  invited_at      TIMESTAMPTZ,                         -- For invitations
  invited_by      TEXT,                                -- User ID who sent the invite
  accepted_at     TIMESTAMPTZ,                         -- When they accepted the invite
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  
  -- Uniqueness: one user per organization
  CONSTRAINT unique_org_member UNIQUE (organization_id, user_id)
);

-- Index for listing members by organization
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members (organization_id);

-- Index for listing organizations by user
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members (user_id);

-- Index for active members
CREATE INDEX IF NOT EXISTS idx_org_members_active ON organization_members (is_active);

-- Index for finding pending invites
CREATE INDEX IF NOT EXISTS idx_org_members_pending_invites 
  ON organization_members (user_id, accepted_at) 
  WHERE accepted_at IS NULL AND is_active = true;

COMMENT ON TABLE organization_members IS 'Organization membership with role-based access control.';
COMMENT ON COLUMN organization_members.user_id IS 'Stellar public key or email of the member.';
COMMENT ON COLUMN organization_members.role IS 'Role in organization: OWNER, ADMIN, MEMBER, VIEWER.';
COMMENT ON COLUMN organization_members.invited_at IS 'Timestamp when invite was sent (NULL if not invited).';
COMMENT ON COLUMN organization_members.accepted_at IS 'Timestamp when member accepted the invite.';

-- ---------------------------------------------------------------------------
-- Add organization_id to existing tables
-- ---------------------------------------------------------------------------

-- api_keys: scope API keys to organizations
ALTER TABLE IF EXISTS api_keys
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

-- Create index for org-scoped API key queries
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id 
  ON api_keys (organization_id) 
  WHERE is_active = true;

-- links: associate links with organizations
-- (This table structure depends on existing links table; adjust as needed)
-- ALTER TABLE links ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS idx_links_organization_id ON links (organization_id);

-- transactions: associate transactions with organizations
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS idx_transactions_organization_id ON transactions (organization_id);

-- webhooks: associate webhooks with organizations
-- ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks (organization_id);

-- ---------------------------------------------------------------------------
-- Helper: Create default organization for existing user
-- ---------------------------------------------------------------------------
-- This procedure will be called when a user first uses the system to auto-create
-- a default organization for backward compatibility during migration.

CREATE OR REPLACE FUNCTION create_default_organization_for_user(user_public_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
  slug_base TEXT;
  slug_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract first 8 chars of public key as base slug
  slug_base := lower(substring(user_public_key, 1, 8));
  slug_name := slug_base;
  
  -- Check if org already exists for this user
  SELECT id INTO org_id FROM organizations WHERE owner_id = user_public_key LIMIT 1;
  IF FOUND THEN
    RETURN org_id;
  END IF;
  
  -- Ensure slug uniqueness by adding counter if needed
  WHILE EXISTS(SELECT 1 FROM organizations WHERE slug = slug_name) LOOP
    counter := counter + 1;
    slug_name := slug_base || counter::TEXT;
  END LOOP;
  
  -- Create default organization
  INSERT INTO organizations (name, slug, description, owner_id)
  VALUES (
    'Default Workspace',
    slug_name,
    'Default workspace for ' || user_public_key,
    user_public_key
  )
  RETURNING id INTO org_id;
  
  -- Add owner as member
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (org_id, user_public_key, 'OWNER', now())
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN org_id;
END;
$$;

COMMENT ON FUNCTION create_default_organization_for_user(TEXT) IS 
  'Creates a default organization for a user if one does not exist. Returns the organization ID.';
