import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '../../organizations/organizations.types';

export const REQUIRE_ROLE_KEY = 'require_role';

/**
 * Decorator to mark that a handler requires one or more specific roles
 * @param roles One or more organization roles required
 */
export const RequireRole = (...roles: OrganizationRole[]) => SetMetadata(REQUIRE_ROLE_KEY, roles);
