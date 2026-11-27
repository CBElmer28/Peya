import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SubadminsController } from './subadmins.controller';
import { SubadminsService } from './subadmins.service';
import { UsersModule } from '../users/users.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [UsersModule, AccountsModule],
  controllers: [AdminController, SubadminsController],
  providers: [AdminService, SubadminsService],
  exports: [AdminService],
})
export class AdminModule {}
