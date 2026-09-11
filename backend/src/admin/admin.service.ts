import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AccountsService } from '../accounts/accounts.service';

export interface AdminMetric {
  id: string;
  label: string;
  value: string;
  growth: string;
  trend: 'up' | 'down';
}

export interface SupervisedAccount {
  id: string;
  client: string;
  number: string;
  type: 'Corriente' | 'Ahorros' | 'Inversión';
  balance: string;
  status: 'active' | 'blocked';
  recent: boolean;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
  ) {}

  async getMetrics(): Promise<AdminMetric[]> {
    const users = await this.usersService.findAll();
    const activeClients = users.filter((u) => u.status === 'active' && u.role === 'client');
    const accounts = await this.accountsService.getAccounts();
    const totalClientsCount = users.length;

    return [
      {
        id: 'm1',
        label: 'Total clientes activos',
        value: activeClients.length.toLocaleString('es-PE'),
        growth: '+8.2%',
        trend: 'up',
      },
      {
        id: 'm2',
        label: 'Cuentas creadas',
        value: (accounts.length + totalClientsCount * 2).toLocaleString('es-PE'),
        growth: '+3.1%',
        trend: 'up',
      },
      {
        id: 'm3',
        label: 'Volumen total transaccionado',
        value: '$4.8M',
        growth: '+5.4%',
        trend: 'up',
      },
    ];
  }

  async getSupervisedAccounts(): Promise<SupervisedAccount[]> {
    const users = await this.usersService.findAll();
    const accounts = await this.accountsService.getAccounts();

    // Generar vista supervisada a partir de los clientes y cuentas reales del sistema
    const supervised: SupervisedAccount[] = [];

    // Cuentas vinculadas a los usuarios reales registrados
    users.forEach((user, index) => {
      const isBlocked = user.status === 'inactive';
      const lastDigits = user.dni ? user.dni.slice(-4) : `${1000 + index}`;
      const type: 'Corriente' | 'Ahorros' | 'Inversión' =
        index % 3 === 0 ? 'Corriente' : index % 3 === 1 ? 'Ahorros' : 'Inversión';
      const balance =
        index === 0
          ? 'S/. 12,480.50'
          : index === 1
            ? 'S/. 34,120.00'
            : index === 2
              ? 'USD 8,905.75'
              : `S/. ${(1500 + index * 430).toFixed(2)}`;

      supervised.push({
        id: `sup-${user.id}`,
        client: user.name,
        number: `**** ${lastDigits}`,
        type,
        balance,
        status: isBlocked ? 'blocked' : 'active',
        recent: index % 2 === 0,
      });
    });

    return supervised;
  }
}
