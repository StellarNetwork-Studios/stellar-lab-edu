import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';
import { OrganizationRole } from '../../organizations/organizations.types';
import { OrganizationsService } from '../../organizations/organizations.service';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if we have organization context from API key
    const orgContext = request.organizationContext;
    if (!orgContext) {
      throw new UnauthorizedException({
        error: 'NO_ORGANIZATION_CONTEXT',
        message: 'Organization context is required for this operation',
      });
    }

    // Get full organization context with permissions
    const fullContext = await this.organizationsService.getOrganizationContext(
      orgContext.user_id,
      orgContext.organization_id,
    );

    if (!fullContext) {
      throw new ForbiddenException({
        error: 'NO_MEMBER_ACCESS',
        message: 'User is not a member of this organization',
      });
    }

    // Check if user's role is in the required roles
    if (!requiredRoles.includes(fullContext.role)) {
      throw new ForbiddenException({
        error: 'INSUFFICIENT_ROLE',
        message: `Required one of roles: ${requiredRoles.join(', ')}, but user has: ${fullContext.role}`,
      });
    }

    // Attach full context to request for use in handlers
    request.organizationContext = fullContext;

    return true;
  }
}
