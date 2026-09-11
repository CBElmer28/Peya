import { Module } from '@nestjs/common';
import { ReniecController } from './reniec.controller';
import { ReniecService } from './reniec.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ReniecController],
  providers: [ReniecService],
  exports: [ReniecService],
})
export class ReniecModule {}
