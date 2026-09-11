import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReniecModule } from './reniec/reniec.module';
import { KycModule } from './kyc/kyc.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    ReniecModule,
    KycModule,
    AccountsModule,
    TransactionsModule,
    AdminModule,
  ],
})
export class AppModule {}
