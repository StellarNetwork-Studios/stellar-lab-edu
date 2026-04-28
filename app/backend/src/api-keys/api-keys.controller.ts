import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CursorPaginationQueryDto } from '../dto/pagination/pagination.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { RequireRole } from '../auth/decorators/require-role.decorator';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  /**
   * POST /api-keys
   * Creates a new API key. The raw key is returned ONCE in the response.
   */
  @Post()
  create(@Body() dto: CreateApiKeyDto) {
    return this.service.create(dto);
  }

  /**
   * GET /api-keys
   * Lists all active keys (masked) with cursor-based pagination. Optionally filter by owner_id.
   */
  @Get()
  @ApiOperation({ summary: 'List API keys with cursor-based pagination' })
  @ApiQuery({ name: 'owner_id', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (1-100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of API keys' })
  list(
    @Query('owner_id') ownerId?: string,
    @Query() pagination?: CursorPaginationQueryDto,
  ) {
    return this.service.listPaginated(ownerId, pagination?.cursor, pagination?.limit);
  }

  /**
   * GET /api-keys/usage
   * Returns aggregated usage/quota stats.
   */
  @Get('usage')
  usage(@Query('owner_id') ownerId?: string) {
    return this.service.getUsage(ownerId);
  }

  /**
   * DELETE /api-keys/:id
   * Revokes (soft-deletes) a key.
   */
  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.revoke(id);
  }

  /**
   * POST /api-keys/:id/rotate
   * Invalidates the current key and issues a new one.
   */
  @Post(':id/rotate')
  rotate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.rotate(id);
  }

  // =========================================================================
  // Organization-scoped API Key endpoints
  // =========================================================================
  // These endpoints allow managing API keys scoped to a specific organization

  /**
   * POST /organizations/:organizationId/api-keys
   * Creates an API key scoped to the organization
   */
  @Post('organizations/:organizationId/keys')
  @UseGuards(ApiKeyGuard, OrganizationAccessGuard, RoleGuard)
  @RequireRole('ADMIN', 'OWNER')
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiOperation({
    summary: 'Create organization-scoped API key',
    description: 'Creates an API key that is scoped to the organization. Requires ADMIN or OWNER role.',
  })
  async createOrgKey(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateApiKeyDto,
    @Request() req: any,
  ) {
    // Set the organization_id in the DTO
    dto.organization_id = organizationId;
    return this.service.create(dto);
  }

  /**
   * GET /organizations/:organizationId/api-keys
   * Lists all API keys for the organization
   */
  @Get('organizations/:organizationId/keys')
  @UseGuards(ApiKeyGuard, OrganizationAccessGuard)
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiOperation({
    summary: 'List organization API keys',
    description: 'Returns all API keys associated with this organization',
  })
  async listOrgKeys(
    @Param('organizationId') organizationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.listPaginated(undefined, cursor, limit);
  }

  /**
   * DELETE /organizations/:organizationId/api-keys/:keyId
   * Revokes an API key for the organization
   */
  @Delete('organizations/:organizationId/keys/:keyId')
  @UseGuards(ApiKeyGuard, OrganizationAccessGuard, RoleGuard)
  @RequireRole('ADMIN', 'OWNER')
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiOperation({
    summary: 'Revoke organization API key',
    description: 'Revokes an API key. Requires ADMIN or OWNER role.',
  })
  async revokeOrgKey(
    @Param('organizationId') organizationId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return this.service.revoke(keyId);
  }

  /**
   * POST /organizations/:organizationId/api-keys/:keyId/rotate
   * Rotates an API key for the organization
   */
  @Post('organizations/:organizationId/keys/:keyId/rotate')
  @UseGuards(ApiKeyGuard, OrganizationAccessGuard, RoleGuard)
  @RequireRole('ADMIN', 'OWNER')
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiOperation({
    summary: 'Rotate organization API key',
    description: 'Rotates an API key and returns a new one. Requires ADMIN or OWNER role.',
  })
  async rotateOrgKey(
    @Param('organizationId') organizationId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return this.service.rotate(keyId);
  }
}

