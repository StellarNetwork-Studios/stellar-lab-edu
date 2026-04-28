import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from '../src/auth/guards/role.guard';
import { OrganizationAccessGuard } from '../src/auth/guards/organization-access.guard';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { OrganizationContextService } from '../src/organizations/organization-context.service';

describe('RoleGuard (Unit)', () => {
  let guard: RoleGuard;
  let mockReflector: any;
  let mockOrgService: any;

  beforeEach(async () => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    mockOrgService = {
      getOrganizationContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: OrganizationsService,
          useValue: mockOrgService,
        },
      ],
    }).compile();

    guard = module.get<RoleGuard>(RoleGuard);
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            organizationContext: {
              user_id: 'user-123',
              organization_id: 'org-123',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when no organization context', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
      mockOrgService.getOrganizationContext.mockResolvedValue(null);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            organizationContext: {
              user_id: 'user-123',
              organization_id: 'org-123',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when user role is insufficient', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['OWNER']);
      mockOrgService.getOrganizationContext.mockResolvedValue({
        organization_id: 'org-123',
        user_id: 'user-123',
        role: 'MEMBER',
        permissions: new Set(),
      });

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            organizationContext: {
              user_id: 'user-123',
              organization_id: 'org-123',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access when user has required role', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
      mockOrgService.getOrganizationContext.mockResolvedValue({
        organization_id: 'org-123',
        user_id: 'user-123',
        role: 'ADMIN',
        permissions: new Set(['org:write']),
      });

      const mockRequest = {
        organizationContext: {
          user_id: 'user-123',
          organization_id: 'org-123',
        },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(mockRequest.organizationContext.role).toBe('ADMIN');
    });
  });
});

describe('OrganizationAccessGuard (Unit)', () => {
  let guard: OrganizationAccessGuard;
  let mockOrgService: any;
  let mockOrgContextService: any;

  beforeEach(async () => {
    mockOrgService = {
      getOrganizationContext: jest.fn(),
    };

    mockOrgContextService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAccessGuard,
        {
          provide: OrganizationsService,
          useValue: mockOrgService,
        },
        {
          provide: OrganizationContextService,
          useValue: mockOrgContextService,
        },
      ],
    }).compile();

    guard = module.get<OrganizationAccessGuard>(OrganizationAccessGuard);
  });

  describe('canActivate', () => {
    it('should throw BadRequestException when organization ID is missing', async () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: {},
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow();
    });

    it('should throw ForbiddenException when no organization context', async () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { organizationId: 'org-123' },
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when org IDs do not match', async () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { organizationId: 'org-123' },
            body: {},
            organizationContext: {
              organization_id: 'org-456',
              user_id: 'user-123',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access when org IDs match and user is member', async () => {
      mockOrgService.getOrganizationContext.mockResolvedValue({
        organization_id: 'org-123',
        user_id: 'user-123',
        role: 'MEMBER',
        permissions: new Set(),
      });

      const mockRequest = {
        params: { organizationId: 'org-123' },
        body: {},
        organizationContext: {
          organization_id: 'org-123',
          user_id: 'user-123',
        },
      };

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
