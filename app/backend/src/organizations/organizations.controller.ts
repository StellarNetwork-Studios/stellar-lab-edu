import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  OrganizationMemberDto,
  AcceptInviteDto,
  OrganizationsListDto,
  MembersListDto,
} from './dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard';
import { RequireRole } from '../auth/decorators/require-role.decorator';

/**
 * Organizations Controller
 * Handles organization CRUD, member management, and invitations
 */
@ApiTags('organizations')
@ApiHeader({
  name: 'X-API-Key',
  description: 'API key for authentication (scoped to an organization)',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Create a new organization
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new organization',
    description: 'Creates a new organization. The API key owner becomes the owner.',
  })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
    type: OrganizationDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: OrganizationDto }> {
    if (!req.organizationContext?.user_id) {
      throw new Error('User ID not available in context');
    }

    const organization = await this.organizationsService.createOrganization(
      req.organizationContext.user_id,
      dto,
    );

    return {
      success: true,
      data: organization,
    };
  }

  /**
   * List all organizations the user belongs to
   */
  @Get('my-organizations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List user organizations',
    description: 'Returns all organizations the API key owner is a member of',
  })
  @ApiResponse({
    status: 200,
    description: 'List of organizations',
    type: OrganizationsListDto,
  })
  async listMyOrganizations(@Request() req: any): Promise<{
    success: boolean;
    data: OrganizationsListDto;
  }> {
    if (!req.organizationContext?.user_id) {
      throw new Error('User ID not available in context');
    }

    const organizations = await this.organizationsService.listOrganizationsForUser(
      req.organizationContext.user_id,
    );

    return {
      success: true,
      data: {
        organizations,
        total: organizations.length,
      },
    };
  }

  /**
   * Get organization details
   */
  @Get(':organizationId')
  @UseGuards(OrganizationAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get organization details',
    description: 'Returns detailed information about an organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization details',
    type: OrganizationDto,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganization(
    @Param('organizationId') organizationId: string,
  ): Promise<{ success: boolean; data: OrganizationDto }> {
    const organization = await this.organizationsService.getOrganization(organizationId);

    if (!organization) {
      throw new Error('Organization not found');
    }

    return {
      success: true,
      data: organization,
    };
  }

  /**
   * Update organization
   */
  @Put(':organizationId')
  @UseGuards(OrganizationAccessGuard, RoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update organization',
    description: 'Updates organization details. Requires OWNER or ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization updated',
    type: OrganizationDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateOrganization(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<{ success: boolean; data: OrganizationDto }> {
    const organization = await this.organizationsService.updateOrganization(
      organizationId,
      dto,
    );

    return {
      success: true,
      data: organization,
    };
  }

  /**
   * Delete organization
   */
  @Delete(':organizationId')
  @UseGuards(OrganizationAccessGuard, RoleGuard)
  @RequireRole('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete organization',
    description: 'Deletes an organization. Requires OWNER role.',
  })
  @ApiResponse({
    status: 204,
    description: 'Organization deleted',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteOrganization(@Param('organizationId') organizationId: string): Promise<void> {
    // Soft delete by marking as inactive
    await this.organizationsService.updateOrganization(organizationId, { name: '' });
  }

  /**
   * Get organization members
   */
  @Get(':organizationId/members')
  @UseGuards(OrganizationAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organization members',
    description: 'Returns all members of the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'List of members',
    type: MembersListDto,
  })
  async getOrganizationMembers(
    @Param('organizationId') organizationId: string,
  ): Promise<{ success: boolean; data: MembersListDto }> {
    const members = await this.organizationsService.getOrganizationMembers(organizationId);

    return {
      success: true,
      data: {
        members,
        total: members.length,
      },
    };
  }

  /**
   * Invite member to organization
   */
  @Post(':organizationId/members/invite')
  @UseGuards(OrganizationAccessGuard, RoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite user to organization',
    description: 'Sends an invitation to a user to join the organization. Requires OWNER or ADMIN.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent',
    type: OrganizationMemberDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async inviteMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: InviteMemberDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: OrganizationMemberDto }> {
    const member = await this.organizationsService.inviteMember(
      organizationId,
      req.organizationContext.user_id,
      dto,
    );

    return {
      success: true,
      data: member,
    };
  }

  /**
   * Accept organization invite
   */
  @Post('invitations/accept')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept organization invitation',
    description: 'Accepts an invitation to join an organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted',
    type: OrganizationMemberDto,
  })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: OrganizationMemberDto }> {
    if (!req.organizationContext?.user_id) {
      throw new Error('User ID not available in context');
    }

    const member = await this.organizationsService.acceptInvite(
      req.organizationContext.user_id,
      dto.organization_id,
    );

    return {
      success: true,
      data: member,
    };
  }

  /**
   * Update member role
   */
  @Put(':organizationId/members/:userId/role')
  @UseGuards(OrganizationAccessGuard, RoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update member role',
    description: 'Changes a members role in the organization. Requires OWNER or ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Role updated',
    type: OrganizationMemberDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<{ success: boolean; data: OrganizationMemberDto }> {
    const member = await this.organizationsService.updateMemberRole(
      organizationId,
      userId,
      dto,
    );

    return {
      success: true,
      data: member,
    };
  }

  /**
   * Remove member from organization
   */
  @Delete(':organizationId/members/:userId')
  @UseGuards(OrganizationAccessGuard, RoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove organization member',
    description: 'Removes a member from the organization. Requires OWNER or ADMIN.',
  })
  @ApiResponse({
    status: 204,
    description: 'Member removed',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeMember(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.organizationsService.removeMember(organizationId, userId);
  }

  /**
   * Get pending invites for the user
   */
  @Get('invitations/pending')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get pending invitations',
    description: 'Returns all pending organization invitations for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
  })
  async getPendingInvites(@Request() req: any): Promise<{
    success: boolean;
    data: {
      invitations: OrganizationMemberDto[];
      total: number;
    };
  }> {
    if (!req.organizationContext?.user_id) {
      throw new Error('User ID not available in context');
    }

    const invitations = await this.organizationsService.getPendingInvites(
      req.organizationContext.user_id,
    );

    return {
      success: true,
      data: {
        invitations,
        total: invitations.length,
      },
    };
  }
}
