import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ORGANIZATION_KEY = 'require_organization';

/**
 * Decorator to mark that a handler requires organization context
 * The organization ID should be provided in the route parameter or request body
 */
export const RequireOrganization = () => SetMetadata(REQUIRE_ORGANIZATION_KEY, true);
