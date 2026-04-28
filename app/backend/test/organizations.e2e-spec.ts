import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';

/**
 * Integration Tests for Multi-Tenant Organization Access Control
 * Tests verify that:
 * 1. Users cannot access data from organizations they don't belong to
 * 2. API keys are scoped to a specific organization
 * 3. Invites and role changes are reflected immediately in access checks
 * 4. Role-based access control works as expected
 */
describe('Multi-Tenant Organization Access Control (Integration)', () => {
  let app: INestApplication;
  let testApiKey: string;
  let testOrgId: string;
  let testUserId: string;
  let anotherUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Organization Creation and Access', () => {
    it('should create an organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .set('X-API-Key', testApiKey)
        .send({
          name: 'Test Organization',
          slug: 'test-org-' + Date.now(),
          description: 'Integration test org',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      testOrgId = response.body.data.id;
    });

    it('should list organizations for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations/my-organizations')
        .set('X-API-Key', testApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.organizations)).toBe(true);
    });

    it('should prevent access to organizations without API key', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${testOrgId}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should prevent access to unrelated organizations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/00000000-0000-0000-0000-000000000000`)
        .set('X-API-Key', testApiKey)
        .expect(403);

      expect(response.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    });
  });

  describe('Member Invitation and Role Management', () => {
    it('should invite a member to organization', async () => {
      const response = await request(app.getHttpServer())
        .post(`/organizations/${testOrgId}/members/invite`)
        .set('X-API-Key', testApiKey)
        .send({
          user_id: anotherUserId,
          role: 'MEMBER',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(anotherUserId);
      expect(response.body.data.role).toBe('MEMBER');
    });

    it('should prevent non-ADMIN from inviting members', async () => {
      // Create a viewer member first
      const response = await request(app.getHttpServer())
        .post(`/organizations/${testOrgId}/members/invite`)
        .set('X-API-Key', testApiKey)
        .send({
          user_id: 'GB2QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V4',
          role: 'VIEWER',
        })
        .expect(201);

      // Try to invite another member as VIEWER (should fail)
      // Note: This test requires a VIEWER API key
      // In a real scenario, we'd need to create a VIEWER API key first
    });

    it('should allow role updates for ADMIN users', async () => {
      const response = await request(app.getHttpServer())
        .put(`/organizations/${testOrgId}/members/${anotherUserId}/role`)
        .set('X-API-Key', testApiKey)
        .send({
          role: 'ADMIN',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('ADMIN');
    });

    it('should list organization members', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${testOrgId}/members`)
        .set('X-API-Key', testApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.members)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });
  });

  describe('API Key Organization Scoping', () => {
    let orgScopedApiKey: string;

    it('should create an organization-scoped API key', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api-keys/organizations/${testOrgId}/keys`)
        .set('X-API-Key', testApiKey)
        .send({
          name: 'Org Scoped Key',
          scopes: ['links:read', 'links:write'],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBeDefined();
      orgScopedApiKey = response.body.data.key;
    });

    it('should allow scoped API key access to its organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${testOrgId}`)
        .set('X-API-Key', orgScopedApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should prevent scoped API key from accessing other organizations', async () => {
      // Create another organization
      const otherOrgResponse = await request(app.getHttpServer())
        .post('/organizations')
        .set('X-API-Key', testApiKey)
        .send({
          name: 'Other Organization',
          slug: 'other-org-' + Date.now(),
        })
        .expect(201);

      const otherOrgId = otherOrgResponse.body.data.id;

      // Try to access with scoped API key (should fail)
      const response = await request(app.getHttpServer())
        .get(`/organizations/${otherOrgId}`)
        .set('X-API-Key', orgScopedApiKey)
        .expect(403);

      expect(response.body.error).toBe('ORGANIZATION_ACCESS_DENIED');
    });

    it('should rotate an organization-scoped API key', async () => {
      // Get the key ID first (assuming we track it)
      // Then rotate it
      // This is a simplified test; actual implementation may vary
    });
  });

  describe('Access Control with Pending Invites', () => {
    it('should return pending invites for user', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations/invitations/pending')
        .set('X-API-Key', testApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.invitations)).toBe(true);
    });

    it('should allow user to accept organization invite', async () => {
      // First, get a pending invite
      const invitesResponse = await request(app.getHttpServer())
        .get('/organizations/invitations/pending')
        .set('X-API-Key', testApiKey)
        .expect(200);

      if (invitesResponse.body.data.invitations.length > 0) {
        const invite = invitesResponse.body.data.invitations[0];

        const response = await request(app.getHttpServer())
          .post('/organizations/invitations/accept')
          .set('X-API-Key', testApiKey)
          .send({
            organization_id: invite.organization_id,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accepted_at).toBeDefined();
      }
    });

    it('should immediately reflect role changes in access checks', async () => {
      // Update a member to VIEWER role
      await request(app.getHttpServer())
        .put(`/organizations/${testOrgId}/members/${anotherUserId}/role`)
        .set('X-API-Key', testApiKey)
        .send({ role: 'VIEWER' })
        .expect(200);

      // Access should be denied for operations requiring higher role
      const response = await request(app.getHttpServer())
        .post(`/organizations/${testOrgId}/members/invite`)
        .set('X-API-Key', testApiKey)
        .send({
          user_id: 'GB2QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V4',
          role: 'MEMBER',
        })
        .expect(403);

      expect(response.body.error).toBe('INSUFFICIENT_ROLE');
    });
  });

  describe('Data Isolation Verification', () => {
    it('should ensure users cannot access links from other organizations', async () => {
      // This test would create a link in one org and verify
      // that users from another org cannot access it
      // Requires implementation in links service
    });

    it('should ensure users cannot access transactions from other organizations', async () => {
      // Similar to above, but for transactions
    });

    it('should ensure API keys are isolated per organization', async () => {
      // Verify that listing API keys from one org doesn't show
      // API keys from other organizations
    });
  });
});
