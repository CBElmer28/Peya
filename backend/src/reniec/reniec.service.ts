import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

export interface ReniecDniResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
}

@Injectable()
export class ReniecService {
  constructor(private readonly usersService: UsersService) {}

  async lookupDni(dni: string): Promise<ReniecDniResponse> {
    const cleanDni = dni.trim();

    if (cleanDni.length !== 8 || !/^\d{8}$/.test(cleanDni)) {
      throw new BadRequestException('El DNI debe contener exactamente 8 dígitos numéricos.');
    }

    // Verificar si ya existe en la base de datos de usuarios
    const check = await this.usersService.checkDni(cleanDni);
    if (check.exists) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El DNI ingresado ya se encuentra registrado en BankHub.',
        userName: check.userName || 'Usuario Registrado',
      });
    }

    if (cleanDni === '00000000' || cleanDni === '99999999') {
      throw new NotFoundException('DNI no encontrado en el padrón de RENIEC.');
    }

    return {
      dni: cleanDni,
      nombres: 'Priscilla Fernanda',
      apellidoPaterno: 'Quispe',
      apellidoMaterno: 'Torres',
      fechaNacimiento: '12/03/1998',
    };
  }
}
