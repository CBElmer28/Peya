import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { MovementsController } from './movements.controller';
import { AccountsService } from './accounts.service';
import { MovementsService } from './movements.service';

@Module({
  controllers: [AccountsController, MovementsController],
  providers: [AccountsService, MovementsService],
  exports: [AccountsService, MovementsService],
})
export class AccountsModule {}
