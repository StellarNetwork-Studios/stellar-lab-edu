# Multi-Tenant Backend Implementation - Testing Guide

**Date**: April 28, 2026  
**Branch**: feat/be-multi-tenant  
**Complexity**: 200 points

This guide provides step-by-step instructions to verify that the multi-tenant implementation has been successfully completed.

---

## ✅ Acceptance Criteria Validation Checklist

Your assignment is complete when all of the following acceptance criteria are met:

- [ ] **Criterion 1**: Users cannot access data from organizations they don't belong to
- [ ] **Criterion 2**: API keys are scoped to a specific organization
- [ ] **Criterion 3**: Invites and role changes are reflected immediately in access checks

---

## 📋 Prerequisites

Before starting tests, ensure you have:

1. **Backend Running**: `pnpm turbo run dev --filter=backend`
2. **Database Migrated**: Run all migrations from `app/backend/supabase/migrations/`
3. **Test API Key**: An API key scoped to a test organization
4. **Test User IDs**: Two or more Stellar public keys for testing (or emails for non-blockchain users)

### Environment Setup

```bash
# Navigate to backend
cd app/backend

# Install dependencies if needed
pnpm install

# Run migrations (if using local Supabase)
pnpm supabase migration up

# Start development server
pnpm dev

# In another terminal, run tests
pnpm test:e2e
```

---

## 🧪 Phase 1: Database Schema Verification

### Test 1.1: Verify Organization Tables Exist

**Purpose**: Confirm database migrations were applied correctly.

**Steps**:

1. Connect to your Supabase database (via psql or Supabase UI)
2. Run the following query:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('organizations', 'organization_members');
```

**Expected Result**:
```
table_name
------------------
organizations
organization_members
```

### Test 1.2: Verify Foreign Keys and Indexes

**Purpose**: Ensure data integrity constraints are in place.

**Steps**:

1. Run the following query:

```sql
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'organization_members';
```

**Expected Result**:
```
constraint_name               | constraint_type
--------------------------------|------------------
organization_members_pkey      | PRIMARY KEY
unique_org_member              | UNIQUE
fk_org_members_org_id          | FOREIGN KEY
```

2. Verify organization_id exists on api_keys:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'api_keys' AND column_name = 'organization_id';
```

**Expected Result**: `organization_id` column should exist

---

## 🔑 Phase 2: API Key and Organization Setup

### Test 2.1: Create an Organization

**Purpose**: Test organization creation via API.

**Steps**:

1. You'll need an initial API key. If you don't have one, create it via the API:

```bash
curl -X POST http://localhost:3000/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Master Key",
    "scopes": ["links:read", "links:write", "admin"],
    "owner_id": "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW"
  }'
```

2. Save the returned API key (appears once in response)

3. Create an organization:

```bash
export API_KEY="qx_your_actual_key_here"

curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Organization",
    "slug": "test-org-'$(date +%s)'",
    "description": "For testing multi-tenant features"
  }'
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Test Organization",
    "slug": "test-org-1719475200",
    "description": "For testing multi-tenant features",
    "owner_id": "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW",
    "is_active": true,
    "created_at": "2026-04-28T10:00:00Z",
    "updated_at": "2026-04-28T10:00:00Z"
  }
}
```

**Save the organization ID** for use in subsequent tests: `export ORG_ID="550e8400-e29b-41d4-a716-446655440000"`

### Test 2.2: Verify API Key is Scoped to Organization

**Purpose**: Confirm API keys are properly associated with organizations.

**Steps**:

1. Query the database directly:

```sql
SELECT id, name, organization_id, owner_id FROM api_keys 
WHERE name = 'Test Master Key' LIMIT 1;
```

**Expected Result**: organization_id should contain a valid UUID

---

## 🔐 Phase 3: Acceptance Criterion 1 - Data Isolation

### Test 3.1: Users Cannot Access Other Organizations

**Purpose**: Verify users cannot access organizations they don't belong to.

**Steps**:

1. Create a second organization with the same API key:

```bash
curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Second Test Organization",
    "slug": "test-org-2-'$(date +%s)'"
  }'
```

2. Save the second org ID: `export ORG_ID_2="..."`

3. Try to access the first organization with API key from different context:

```bash
# This should work - same API key
curl -X GET http://localhost:3000/organizations/$ORG_ID \
  -H "X-API-Key: $API_KEY"
```

**Expected Response** (200 OK)

4. Now create an API key scoped ONLY to ORG_ID:

```bash
curl -X POST http://localhost:3000/organizations/$ORG_ID/keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Org 1 Only Key",
    "scopes": ["links:read", "links:write"]
  }'
```

**Save the response key**: `export ORG1_KEY="qx_org1_key_here"`

5. Try to access ORG_ID_2 with ORG1_KEY:

```bash
curl -X GET http://localhost:3000/organizations/$ORG_ID_2 \
  -H "X-API-Key: $ORG1_KEY"
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "ORGANIZATION_ACCESS_DENIED",
  "message": "You do not have access to this organization"
}
```

✅ **Criterion 1 Verified**: API key cannot access organizations it's not scoped to

---

## 🎫 Phase 4: Acceptance Criterion 2 - API Key Scoping

### Test 4.1: Create Organization-Scoped API Keys

**Purpose**: Verify API keys can be scoped to organizations.

**Steps**:

1. Create an API key scoped to ORG_ID:

```bash
curl -X POST http://localhost:3000/organizations/$ORG_ID/keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Links API Key",
    "scopes": ["links:read", "links:write"]
  }'
```

**Expected Response** (201 Created) with `key` field

2. Save the key: `export LINKS_KEY="qx_..."`

3. Verify the key in database:

```sql
SELECT id, name, organization_id, scopes FROM api_keys 
WHERE key_prefix LIKE 'qx_%' ORDER BY created_at DESC LIMIT 1;
```

**Expected Result**: organization_id matches ORG_ID

### Test 4.2: Verify Scoped Key Has Correct Permissions

**Purpose**: Confirm scoped keys only allow their declared scopes.

**Steps**:

1. Try to use LINKS_KEY to read links (should work):

```bash
curl -X POST http://localhost:3000/links/metadata \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $LINKS_KEY" \
  -d '{
    "asset": "USDC",
    "amount": "100",
    "memo": "Test payment"
  }'
```

**Expected Response**: 200 OK (or 400 if validation fails, but request is authorized)

### Test 4.3: Quota Tracking Per API Key

**Purpose**: Verify usage is tracked correctly.

**Steps**:

1. Make several requests with the scoped key

2. Check usage in database:

```sql
SELECT id, name, request_count, monthly_quota FROM api_keys 
WHERE name = 'Links API Key';
```

**Expected Result**: request_count should increase with each request

✅ **Criterion 2 Verified**: API keys are scoped to organizations with proper quota tracking

---

## 👥 Phase 5: Acceptance Criterion 3 - Invite & Role Management

### Test 5.1: Invite Member to Organization

**Purpose**: Test member invitation workflow.

**Steps**:

1. Invite another user to the organization:

```bash
export INVITED_USER="GB2QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V4"

curl -X POST http://localhost:3000/organizations/$ORG_ID/members/invite \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "user_id": "'$INVITED_USER'",
    "role": "MEMBER"
  }'
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "organization_id": "...",
    "user_id": "GB2QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V4",
    "role": "MEMBER",
    "invited_at": "2026-04-28T10:05:00Z",
    "invited_by": "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJEEN54SCBULBUKPXWVZVFXWWW",
    "accepted_at": null,
    "is_active": true,
    "created_at": "2026-04-28T10:05:00Z",
    "updated_at": "2026-04-28T10:05:00Z"
  }
}
```

### Test 5.2: User Cannot Access Organization Before Accepting Invite

**Purpose**: Verify pending invites don't grant access.

**Steps**:

1. Try to access organization as the invited user (create API key for INVITED_USER first):

```bash
# This would require creating an API key for INVITED_USER
# Simulate: Create a key and try to list orgs
curl -X GET http://localhost:3000/organizations/my-organizations \
  -H "X-API-Key: $INVITED_USER_KEY"
```

**Expected**: The invitation should NOT appear as an accessible organization yet

### Test 5.3: User Accepts Invite and Can Now Access

**Purpose**: Verify role changes are immediately reflected.

**Steps**:

1. Accept the invitation:

```bash
curl -X POST http://localhost:3000/organizations/invitations/accept \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $INVITED_USER_KEY" \
  -d '{
    "organization_id": "'$ORG_ID'"
  }'
```

**Expected Response** (200 OK) with `accepted_at` field populated

2. Now the user can access the organization:

```bash
curl -X GET http://localhost:3000/organizations/$ORG_ID \
  -H "X-API-Key: $INVITED_USER_KEY"
```

**Expected Response** (200 OK) - access is granted

### Test 5.4: Update Member Role and Verify Immediate Effect

**Purpose**: Verify permission changes take effect immediately.

**Steps**:

1. Update invited user to ADMIN role:

```bash
curl -X PUT http://localhost:3000/organizations/$ORG_ID/members/$INVITED_USER/role \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "role": "ADMIN"
  }'
```

**Expected Response** (200 OK) with role changed to ADMIN

2. Verify the user can now perform admin actions (invite others):

```bash
curl -X POST http://localhost:3000/organizations/$ORG_ID/members/invite \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $INVITED_USER_KEY" \
  -d '{
    "user_id": "GB3QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V5",
    "role": "VIEWER"
  }'
```

**Expected Response** (201 Created) - action succeeds due to ADMIN role

3. Change role back to VIEWER:

```bash
curl -X PUT http://localhost:3000/organizations/$ORG_ID/members/$INVITED_USER/role \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "role": "VIEWER"
  }'
```

4. Verify access is immediately restricted:

```bash
curl -X POST http://localhost:3000/organizations/$ORG_ID/members/invite \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $INVITED_USER_KEY" \
  -d '{
    "user_id": "GB4QYZTOKPZQZNMW5TNFVXS3QVLVFBQ4GGKV4PK5KU4VN3W37GBHFZ46V6",
    "role": "MEMBER"
  }'
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "INSUFFICIENT_ROLE",
  "message": "Required one of roles: ADMIN, OWNER, but user has: VIEWER"
}
```

✅ **Criterion 3 Verified**: Invites and role changes are immediately reflected in access checks

---

## 🧪 Phase 6: Automated Testing

### Test 6.1: Run Unit Tests

**Purpose**: Verify business logic is correct.

**Steps**:

```bash
cd app/backend

# Run unit tests for organizations
pnpm test:unit -- organizations.service.unit.spec

# Run unit tests for guards
pnpm test:unit -- auth.guards.spec
```

**Expected Result**: All tests pass ✅

### Test 6.2: Run Integration Tests

**Purpose**: Verify components work together correctly.

**Steps**:

```bash
cd app/backend

# Run integration tests
pnpm test:int -- organizations.service.int.spec
```

**Expected Result**: All tests pass ✅

### Test 6.3: Run E2E Tests

**Purpose**: Verify full workflows work end-to-end.

**Steps**:

```bash
cd app/backend

# Run E2E tests
pnpm test:e2e -- organizations.e2e-spec
```

**Expected Result**: All tests pass ✅

---

## 🔄 Phase 7: Edge Cases and Security Validation

### Test 7.1: Prevent Role Escalation

**Purpose**: Ensure members cannot promote themselves to higher roles.

**Steps**:

1. Create a MEMBER user

2. As MEMBER, try to promote themselves to OWNER:

```bash
curl -X PUT http://localhost:3000/organizations/$ORG_ID/members/$MEMBER_USER_ID/role \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MEMBER_KEY" \
  -d '{
    "role": "OWNER"
  }'
```

**Expected Response** (403 Forbidden) - members cannot change their own roles

### Test 7.2: Prevent Cross-Organization Access

**Purpose**: Ensure data from one org never leaks to another.

**Steps**:

1. Create resources in ORG_ID (e.g., links, transactions)

2. Create a different API key for ORG_ID_2

3. Try to query resources from ORG_ID using ORG_ID_2 key:

```bash
curl -X GET "http://localhost:3000/links?org_id=$ORG_ID" \
  -H "X-API-Key: $ORG_ID_2_KEY"
```

**Expected Result**: Either 404 Not Found or 403 Forbidden (not 200 OK with data)

### Test 7.3: Verify API Key Scope Enforcement

**Purpose**: Ensure scoped keys cannot exceed their defined scopes.

**Steps**:

1. Create an API key with only `links:read` scope

2. Try to perform a `links:write` operation:

```bash
curl -X POST http://localhost:3000/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $READ_ONLY_KEY" \
  -d '{"name": "Test"}'
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "INSUFFICIENT_SCOPE",
  "message": "API key missing required scope: links:write"
}
```

---

## ✨ Phase 8: Performance Validation

### Test 8.1: Verify Organization Lookup is Efficient

**Purpose**: Ensure organization context extraction doesn't slow down requests significantly.

**Steps**:

1. Create 10 API keys

2. Make 100 requests with each key

3. Monitor database query performance:

```sql
-- Check for slow queries in Supabase logs
SELECT query, mean_time, calls FROM pg_stat_statements 
WHERE query LIKE '%organization%' 
ORDER BY mean_time DESC;
```

**Expected Result**: Average query time < 50ms for organization lookups

---

## 📊 Summary: Verification Checklist

Use this checklist to confirm all requirements are met:

### Core Functionality
- [ ] Organizations can be created
- [ ] Members can be invited with roles
- [ ] Invitations can be accepted
- [ ] Member roles can be updated
- [ ] API keys can be created and scoped to organizations

### Data Isolation (Criterion 1)
- [ ] Users cannot access organizations they don't belong to
- [ ] Attempting to access unauthorized organization returns 403
- [ ] Database queries properly filter by organization_id
- [ ] Pagination respects organization boundaries

### API Key Scoping (Criterion 2)
- [ ] API keys have organization_id set
- [ ] Scoped keys cannot access other organizations
- [ ] Scoped keys respect their declared scopes
- [ ] Usage is tracked per key
- [ ] Keys can be rotated without losing scope

### Invite & Role Management (Criterion 3)
- [ ] Pending invites don't grant access
- [ ] Accepted invites grant access immediately
- [ ] Role changes take effect immediately
- [ ] Insufficient role returns 403 Forbidden
- [ ] Role changes are reflected in next request

### Security
- [ ] No SQL injection vulnerabilities
- [ ] Role escalation is prevented
- [ ] Cross-organization data access is blocked
- [ ] Scope enforcement is working
- [ ] Unauthorized access is properly denied

### Testing
- [ ] Unit tests pass: `pnpm test:unit`
- [ ] Integration tests pass: `pnpm test:int`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] All guards are tested
- [ ] All decorators are tested

---

## 🎯 Final Validation

### Command to Run All Tests

```bash
cd app/backend

# Install dependencies
pnpm install

# Run linting
pnpm lint

# Type checking
pnpm type-check

# All tests
pnpm test

# E2E tests specifically
pnpm test:e2e
```

### Expected Output

```
✓ Organizations can be created
✓ Users cannot access other organizations
✓ API keys are properly scoped
✓ Role changes take effect immediately
✓ Invites work correctly
✓ All guards are functional

Test Suites: 5 passed, 5 total
Tests:       47 passed, 47 total
```

---

## 📝 Notes for Reviewers

1. **Database Migrations**: All migrations in `app/backend/supabase/migrations/202604280000*` must be applied
2. **Environment Variables**: Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
3. **API Key Format**: Keys follow pattern `qx_` + random string
4. **Organization IDs**: Are UUIDs in Supabase
5. **Role Hierarchy**: OWNER > ADMIN > MEMBER > VIEWER

---

## 🚀 Deployment Checklist

Before merging to main:

- [ ] All tests pass
- [ ] Code is properly formatted (`pnpm lint --fix`)
- [ ] TypeScript has no errors (`pnpm type-check`)
- [ ] Database migrations are reversible
- [ ] Backward compatibility is maintained
- [ ] Documentation is updated
- [ ] Acceptance criteria are met
- [ ] Security review is complete

---

**Assignment Status**: Ready for Submission ✅

When all sections above are completed and verified, the multi-tenant backend implementation is complete and ready for production deployment.
