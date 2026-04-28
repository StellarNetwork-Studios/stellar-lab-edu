import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Organization,
  OrganizationMember,
  OrganizationContext,
  OrganizationRole,
  ROLE_PERMISSIONS,
} from './organizations.types';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto';

@Injectable()
export class OrganizationsService {
  private logger = new Logger(OrganizationsService.name);
  private supabase: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Get or create default organization for a user
   * @param userId Stellar public key of the user
   * @returns Organization ID
   */
  async getOrCreateDefaultOrganization(userId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc(
      'create_default_organization_for_user',
      { user_public_key: userId },
    );

    if (error) {
      this.logger.error('Failed to create default organization', {
        userId,
        error: error.message,
      });
      throw error;
    }

    return data as string;
  }

  /**
   * Create a new organization
   * @param userId ID of the user creating the organization (will be owner)
   * @param dto Create organization DTO
   * @returns Created organization
   */
  async createOrganization(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    const { data, error } = await this.supabase
      .from('organizations')
      .insert({
        name: dto.name,
        slug: dto.slug,
        description: dto.description || null,
        owner_id: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException(`Organization slug '${dto.slug}' already exists`);
      }
      this.logger.error('Failed to create organization', { userId, dto, error: error.message });
      throw error;
    }

    // Add creator as OWNER member
    await this.supabase.from('organization_members').insert({
      organization_id: data.id,
      user_id: userId,
      role: 'OWNER',
      accepted_at: new Date().toISOString(),
    });

    return data;
  }

  /**
   * Get organization by ID
   * @param organizationId Organization ID
   * @returns Organization data or null
   */
  async getOrganization(organizationId: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      this.logger.error('Failed to fetch organization', { organizationId, error: error.message });
      throw error;
    }

    return data || null;
  }

  /**
   * Update organization
   * @param organizationId Organization ID
   * @param dto Update organization DTO
   * @returns Updated organization
   */
  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const { data, error } = await this.supabase
      .from('organizations')
      .update({
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(`Organization slug '${dto.slug}' already exists`);
      }
      this.logger.error('Failed to update organization', {
        organizationId,
        error: error.message,
      });
      throw error;
    }

    if (!data) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }

    return data;
  }

  /**
   * List organizations for a user
   * @param userId User ID to list organizations for
   * @returns Array of organizations the user is a member of
   */
  async listOrganizationsForUser(userId: string): Promise<Organization[]> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select(
        `
        organization_id,
        organizations:organization_id (
          id,
          name,
          slug,
          description,
          owner_id,
          is_active,
          created_at,
          updated_at
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to list organizations for user', { userId, error: error.message });
      throw error;
    }

    return (data as any[])
      .map((item) => item.organizations)
      .filter(Boolean)
      .flat() as Organization[];
  }

  /**
   * Get organization context (org + role + permissions) for a user
   * @param userId User ID
   * @param organizationId Organization ID
   * @returns Organization context with permissions or null if not member
   */
  async getOrganizationContext(userId: string, organizationId: string): Promise<OrganizationContext | null> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Failed to get organization context', {
        userId,
        organizationId,
        error: error.message,
      });
      throw error;
    }

    if (!data) {
      return null; // User is not a member of this organization
    }

    const permissions = ROLE_PERMISSIONS[data.role as OrganizationRole];

    return {
      organization_id: organizationId,
      user_id: userId,
      role: data.role as OrganizationRole,
      permissions,
    };
  }

  /**
   * Invite a user to an organization
   * @param organizationId Organization ID
   * @param invitedBy User ID of the inviter
   * @param dto Invite member DTO
   * @returns Created invite (organization member record)
   */
  async inviteMember(
    organizationId: string,
    invitedBy: string,
    dto: InviteMemberDto,
  ): Promise<OrganizationMember> {
    // Check if member already exists
    const { data: existing } = await this.supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', dto.user_id)
      .single();

    if (existing) {
      throw new ConflictException(`User ${dto.user_id} is already a member of this organization`);
    }

    const { data, error } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: dto.user_id,
        role: dto.role,
        invited_at: new Date().toISOString(),
        invited_by: invitedBy,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to invite member', {
        organizationId,
        userId: dto.user_id,
        error: error.message,
      });
      throw error;
    }

    return data;
  }

  /**
   * Accept an organization invite
   * @param userId User ID accepting the invite
   * @param organizationId Organization ID
   * @returns Updated organization member record
   */
  async acceptInvite(userId: string, organizationId: string): Promise<OrganizationMember> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .update({ accepted_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to accept invite', {
        userId,
        organizationId,
        error: error.message,
      });
      throw error;
    }

    if (!data) {
      throw new NotFoundException(
        `No pending invite found for user ${userId} in organization ${organizationId}`,
      );
    }

    return data;
  }

  /**
   * Update a member's role
   * @param organizationId Organization ID
   * @param userId User ID of the member to update
   * @param dto Update member role DTO
   * @returns Updated organization member
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<OrganizationMember> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .update({ role: dto.role })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update member role', {
        organizationId,
        userId,
        role: dto.role,
        error: error.message,
      });
      throw error;
    }

    if (!data) {
      throw new NotFoundException(
        `Member ${userId} not found in organization ${organizationId}`,
      );
    }

    return data;
  }

  /**
   * Remove a member from organization
   * @param organizationId Organization ID
   * @param userId User ID of the member to remove
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    // Soft delete by marking as inactive
    const { error } = await this.supabase
      .from('organization_members')
      .update({ is_active: false })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to remove member', {
        organizationId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all members of an organization
   * @param organizationId Organization ID
   * @returns Array of organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to get organization members', {
        organizationId,
        error: error.message,
      });
      throw error;
    }

    return data || [];
  }

  /**
   * Get pending invites for a user
   * @param userId User ID
   * @returns Array of pending organization invites
   */
  async getPendingInvites(userId: string): Promise<OrganizationMember[]> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .is('accepted_at', null)
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to get pending invites', { userId, error: error.message });
      throw error;
    }

    return data || [];
  }
}
