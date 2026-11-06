import { Module } from '@nestjs/common';
import { LearnersController } from './learners.controller';
import { PeopleController } from './people.controller';
import { PeopleManager } from './people.manager';
import { PeopleRepository } from './people.repository';

@Module({
  controllers: [PeopleController, LearnersController],
  providers: [PeopleManager, PeopleRepository],
})
export class PeopleModule {}
