import { Module } from '@nestjs/common';
import { LearnersController } from './learners.controller.js';
import { PeopleController } from './people.controller.js';
import { PeopleManager } from './people.manager.js';
import { PeopleRepository } from './people.repository.js';

@Module({
  controllers: [PeopleController, LearnersController],
  providers: [PeopleManager, PeopleRepository],
})
export class PeopleModule {}
