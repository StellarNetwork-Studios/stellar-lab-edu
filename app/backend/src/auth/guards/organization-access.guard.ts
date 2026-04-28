import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationsService } from '../../organizations/organizations.service';
import { OrganizationContextService } from '../../organizations/organization-context.service';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationAccessGuard.name);

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly orgContextService: OrganizationContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { params, body } = request;

    // Get organization ID from route parameter or request body
    const organizationId =
      params.organizationId || params.orgId || body?.organization_id || body?.orgId;

    if (!organizationId) {
      // If no org ID provided and this guard is used, something is wrong
      throw new BadRequestException({
        error: 'MISSING_ORGANIZATION_ID',
        message: 'Organization ID is required',
      });
    }

    // Check if we have organization context from API key
    const orgContext = request.organizationContext;
    if (!orgContext) {
      throw new ForbiddenException({
        error: 'NO_ORGANIZATION_CONTEXT',
        message: 'API key or authorization is required',
      });
    }

    // Verify that the requested organization matches the API key's organization
    if (organizationId !== orgContext.organization_id) {
      this.logger.warn('Organization access denied', {
        requestedOrg: organizationId,
        apiKeyOrg: orgContext.organization_id,
        userId: orgContext.user_id,
      });

      throw new ForbiddenException({
        error: 'ORGANIZATION_ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
    }

    // Verify user is actually a member of this organization
    const context_ = await this.organizationsService.getOrganizationContext(
      orgContext.user_id,
      organizationId,
    );

    if (!context_) {
      throw new ForbiddenException({
        error: 'NOT_ORGANIZATION_MEMBER',
        message: 'User is not a member of this organization',
      });
    }

    // Update request context with full information
    request.organizationContext = context_;
    request.organizationId = organizationId;

    return true;
  }
}
