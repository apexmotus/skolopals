import { Module } from '@nestjs/common';
import { SupabaseAdminModule } from '../../common/supabase-admin/supabase-admin.module.js';
import { LearnersController } from './learners.controller.js';
import { PeopleController } from './people.controller.js';
import { PeopleManager } from './people.manager.js';
import { PeopleRepository } from './people.repository.js';

@Module({
  imports: [SupabaseAdminModule],
  controllers: [PeopleController, LearnersController],
  providers: [PeopleManager, PeopleRepository],
})
export class PeopleModule {}
