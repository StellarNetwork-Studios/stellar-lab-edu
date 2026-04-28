import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { OrganizationRole } from './organizations.types';

/**
 * Request DTO for creating a new organization
 */
export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'My Company',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug (lowercase, no spaces)',
    example: 'my-company',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Organization description',
    example: 'A description of the organization',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Request DTO for updating an organization
 */
export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: 'Organization name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization slug',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Organization description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Response DTO for organization data
 */
export class OrganizationDto {
  @ApiProperty({
    description: 'Organization ID',
  })
  id: string;

  @ApiProperty({
    description: 'Organization name',
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Organization description',
  })
  description?: string;

  @ApiProperty({
    description: 'Owner ID (Stellar public key)',
  })
  owner_id: string;

  @ApiProperty({
    description: 'Whether the organization is active',
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Created timestamp',
  })
  created_at: string;

  @ApiProperty({
    description: 'Updated timestamp',
  })
  updated_at: string;
}

/**
 * Request DTO for inviting a member to an organization
 */
export class InviteMemberDto {
  @ApiProperty({
    description: 'User ID (Stellar public key or email) to invite',
    example: 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW',
  })
  @IsString()
  user_id: string;

  @ApiProperty({
    description: 'Role to assign to the invited member',
    enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
    example: 'MEMBER',
  })
  @IsEnum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  role: OrganizationRole;
}

/**
 * Request DTO for updating a member's role
 */
export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role for the member',
    enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  })
  @IsEnum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  role: OrganizationRole;
}

/**
 * Response DTO for organization member data
 */
export class OrganizationMemberDto {
  @ApiProperty({
    description: 'Member ID',
  })
  id: string;

  @ApiProperty({
    description: 'Organization ID',
  })
  organization_id: string;

  @ApiProperty({
    description: 'User ID (Stellar public key or email)',
  })
  user_id: string;

  @ApiProperty({
    description: 'Member role',
  })
  role: OrganizationRole;

  @ApiPropertyOptional({
    description: 'When the invitation was sent',
  })
  invited_at?: string;

  @ApiPropertyOptional({
    description: 'User ID of who sent the invitation',
  })
  invited_by?: string;

  @ApiPropertyOptional({
    description: 'When the invitation was accepted',
  })
  accepted_at?: string;

  @ApiProperty({
    description: 'Whether the member is active',
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Created timestamp',
  })
  created_at: string;

  @ApiProperty({
    description: 'Updated timestamp',
  })
  updated_at: string;
}

/**
 * Request DTO for accepting an organization invite
 */
export class AcceptInviteDto {
  @ApiProperty({
    description: 'Organization ID to accept invitation for',
    format: 'uuid',
  })
  @IsUUID()
  organization_id: string;
}

/**
 * Response DTO for list of organizations
 */
export class OrganizationsListDto {
  @ApiProperty({
    type: [OrganizationDto],
    description: 'List of organizations',
  })
  organizations: OrganizationDto[];

  @ApiProperty({
    description: 'Total count of organizations',
  })
  total: number;
}

/**
 * Response DTO for member list
 */
export class MembersListDto {
  @ApiProperty({
    type: [OrganizationMemberDto],
    description: 'List of organization members',
  })
  members: OrganizationMemberDto[];

  @ApiProperty({
    description: 'Total count of members',
  })
  total: number;
}
