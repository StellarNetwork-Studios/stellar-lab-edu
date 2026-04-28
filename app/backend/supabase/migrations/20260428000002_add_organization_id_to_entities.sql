-- =============================================================================
-- Add organization_id to core entities
-- =============================================================================
-- This migration adds organization_id foreign keys to all core entities that
-- need to be isolated per organization.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Update api_keys table
-- ---------------------------------------------------------------------------
-- Note: api_keys table should already have organization_id from the previous migration.
-- This ensures the migration is idempotent.

-- Verify organization_id column exists (if not, add it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_keys' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE api_keys
      ADD COLUMN organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
    
    CREATE INDEX idx_api_keys_organization_id 
      ON api_keys (organization_id) 
      WHERE is_active = true;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Add organization_id to notifications table (if exists)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') 
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'notification_preferences' AND column_name = 'organization_id'
    )
  THEN
    ALTER TABLE notification_preferences
      ADD COLUMN organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
    
    CREATE INDEX idx_notification_preferences_org_id 
      ON notification_preferences (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Add organization_id to refund tables (if exists)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_attempts')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'refund_attempts' AND column_name = 'organization_id'
    )
  THEN
    ALTER TABLE refund_attempts
      ADD COLUMN organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
    
    CREATE INDEX idx_refund_attempts_org_id 
      ON refund_attempts (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Update existing API keys: assign to default org if none exists
-- ---------------------------------------------------------------------------
-- This ensures existing API keys continue to work during migration by
-- assigning them to the owner's default organization.

DO $$
DECLARE
  api_key_record RECORD;
  default_org_id UUID;
BEGIN
  -- Only run if there are api_keys without organization_id
  FOR api_key_record IN 
    SELECT DISTINCT owner_id FROM api_keys WHERE organization_id IS NULL AND owner_id IS NOT NULL
  LOOP
    -- Get or create default org for this owner
    SELECT create_default_organization_for_user(api_key_record.owner_id) INTO default_org_id;
    
    -- Update API keys to use the default org
    UPDATE api_keys 
    SET organization_id = default_org_id 
    WHERE owner_id = api_key_record.owner_id AND organization_id IS NULL;
  END LOOP;
END $$;
