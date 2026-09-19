import { Controller, Get, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('Cuentas Bancarias (Account-Service)')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las cuentas bancarias del usuario' })
  async getAccounts() {
    return this.accountsService.getAccounts();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Abrir una nueva cuenta bancaria' })
  @ApiResponse({ status: 201, description: 'Cuenta creada con éxito.' })
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Obtener el historial reciente de movimientos' })
  async getMovements() {
    return this.accountsService.getMovements();
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Obtener las notificaciones del usuario' })
  async getNotifications() {
    return this.accountsService.getNotifications();
  }
}
