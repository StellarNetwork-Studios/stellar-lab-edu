import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationContextService } from './organization-context.service';
import { OrganizationsController } from './organizations.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [OrganizationsService, OrganizationContextService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, OrganizationContextService],
})
export class OrganizationsModule {}
