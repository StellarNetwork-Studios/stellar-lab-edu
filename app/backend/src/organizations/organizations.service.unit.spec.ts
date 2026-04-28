import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateOrganizationDto, InviteMemberDto } from './dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('OrganizationsService (Unit)', () => {
  let service: OrganizationsService;
  let mockSupabaseClient: any;
  let mockSupabaseService: any;

  beforeEach(async () => {
    // Mock Supabase client methods
    mockSupabaseClient = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('createOrganization', () => {
    it('should create an organization and add creator as OWNER', async () => {
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';
      const dto: CreateOrganizationDto = {
        name: 'Test Org',
        slug: 'test-org',
        description: 'Test organization',
      };

      const expectedOrg = {
        id: 'org-123',
        ...dto,
        owner_id: userId,
        is_active: true,
        created_at: '2026-04-28T00:00:00Z',
        updated_at: '2026-04-28T00:00:00Z',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedOrg,
        error: null,
      });

      const result = await service.createOrganization(userId, dto);

      expect(result).toEqual(expectedOrg);
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug already exists', async () => {
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';
      const dto: CreateOrganizationDto = {
        name: 'Test Org',
        slug: 'existing-slug',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Unique constraint violation' },
      });

      await expect(service.createOrganization(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getOrganizationContext', () => {
    it('should return organization context for a member', async () => {
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';
      const orgId = 'org-123';

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 'member-123',
          organization_id: orgId,
          user_id: userId,
          role: 'ADMIN',
          is_active: true,
        },
        error: null,
      });

      const context = await service.getOrganizationContext(userId, orgId);

      expect(context).toBeDefined();
      expect(context?.role).toBe('ADMIN');
      expect(context?.permissions.size).toBeGreaterThan(0);
    });

    it('should return null if user is not a member', async () => {
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';
      const orgId = 'org-123';

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const context = await service.getOrganizationContext(userId, orgId);

      expect(context).toBeNull();
    });
  });

  describe('inviteMember', () => {
    it('should invite a new member to organization', async () => {
      const orgId = 'org-123';
      const invitedBy = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';
      const dto: InviteMemberDto = {
        user_id: 'GB2QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V4',
        role: 'MEMBER',
      };

      // Mock the check for existing member (should not exist)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock the insert response
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'invite-123',
          organization_id: orgId,
          user_id: dto.user_id,
          role: dto.role,
          invited_at: '2026-04-28T00:00:00Z',
          invited_by: invitedBy,
        },
        error: null,
      });

      const result = await service.inviteMember(orgId, invitedBy, dto);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(dto.user_id);
      expect(result.role).toBe('MEMBER');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const orgId = 'org-123';
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 'member-123',
          organization_id: orgId,
          user_id: userId,
          role: 'ADMIN',
          is_active: true,
        },
        error: null,
      });

      const result = await service.updateMemberRole(orgId, userId, { role: 'ADMIN' });

      expect(result.role).toBe('ADMIN');
    });

    it('should throw NotFoundException if member not found', async () => {
      const orgId = 'org-123';
      const userId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW';

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        service.updateMemberRole(orgId, userId, { role: 'VIEWER' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
