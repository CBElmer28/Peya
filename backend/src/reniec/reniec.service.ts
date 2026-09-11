import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

export interface ReniecDniResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
}

const FIRST_NAMES = [
  'Carlos Alberto',
  'María Elena',
  'José Luis',
  'Ana Lucía',
  'Diego Alonso',
  'Valeria Nicole',
  'Jorge Luis',
  'Camila Sofía',
  'Mateo Alexander',
  'Claudia Patricia',
  'Gabriel Ignacio',
  'Andrea Paola',
  'Luis Fernando',
  'Daniela Fernanda',
  'Ricardo Andrés',
  'Luciana Belén',
  'Alejandro David',
  'Gabriela Beatriz',
  'Rodrigo Martín',
  'Paola Cristina',
  'Priscilla Fernanda',
  'Sebastián Leonardo',
  'Fiorella Stefania',
  'Eduardo Daniel',
  'Adriana Jimena',
  'Dario Cesar',
  'Elmer Bradley',
  'Alonso Miguel',
  'Karen Vanessa',
  'Renzo Paolo',
];

const LAST_NAMES = [
  'Quispe',
  'Flores',
  'Rodríguez',
  'Sánchez',
  'García',
  'Rojas',
  'Díaz',
  'Torres',
  'López',
  'Gonzales',
  'Pérez',
  'Vargas',
  'Mamani',
  'Chávez',
  'Mendoza',
  'Espinoza',
  'Castillo',
  'Huamán',
  'Romero',
  'Gutierrez',
  'Fernández',
  'Ruiz',
  'Navarro',
  'Salazar',
  'Morales',
  'Zambrano',
  'Caballero',
  'Cruz',
  'Valdivia',
  'Palomino',
];

const KNOWN_DNI_CATALOG: Record<string, Omit<ReniecDniResponse, 'dni'>> = {
  '48219032': {
    nombres: 'Ana Lucía',
    apellidoPaterno: 'Martínez',
    apellidoMaterno: 'Vega',
    fechaNacimiento: '14/01/1994',
  },
  '10203040': {
    nombres: 'Carlos Eduardo',
    apellidoPaterno: 'Ruiz',
    apellidoMaterno: 'Mendoza',
    fechaNacimiento: '03/02/1991',
  },
  '70809010': {
    nombres: 'Lucía Fernanda',
    apellidoPaterno: 'Fernández',
    apellidoMaterno: 'Castillo',
    fechaNacimiento: '21/02/1997',
  },
  '88888888': {
    nombres: 'Ana María',
    apellidoPaterno: 'Martínez',
    apellidoMaterno: 'Torres',
    fechaNacimiento: '11/04/1990',
  },
  '72918234': {
    nombres: 'Juan Carlos',
    apellidoPaterno: 'Pérez',
    apellidoMaterno: 'Gómez',
    fechaNacimiento: '18/07/1999',
  },
  '06031995': {
    nombres: 'Dario Cesar',
    apellidoPaterno: 'Zambrano',
    apellidoMaterno: 'López',
    fechaNacimiento: '06/03/1995',
  },
};

@Injectable()
export class ReniecService {
  private readonly logger = new Logger(ReniecService.name);

  constructor(private readonly usersService: UsersService) {}

  async lookupDni(dni: string): Promise<ReniecDniResponse> {
    const cleanDni = dni.trim();

    if (cleanDni.length !== 8 || !/^\d{8}$/.test(cleanDni)) {
      throw new BadRequestException('El DNI debe contener exactamente 8 dígitos numéricos.');
    }

    // 1. Verificar si ya existe en la base de datos de usuarios
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

    // 2. Si se ha configurado un TOKEN de API real de RENIEC (ej. ApisPeru, Decolecta, ApiPeru.dev)
    const apiToken = process.env.RENIEC_API_TOKEN || process.env.APIS_PERU_TOKEN;
    if (apiToken) {
      try {
        const apiUrl =
          process.env.RENIEC_API_URL ||
          `https://api.apis.net.pe/v2/reniec/dni?numero=${cleanDni}`;

        const res = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Referer: 'https://apis.net.pe/consulta-dni-api',
          },
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          this.logger.log(`Consulta RENIEC real exitosa para DNI ${cleanDni}`);
          return {
            dni: cleanDni,
            nombres: data.nombres || data.nombre || 'Ciudadano',
            apellidoPaterno: data.apellidoPaterno || data.paterno || '',
            apellidoMaterno: data.apellidoMaterno || data.materno || '',
            fechaNacimiento: data.fechaNacimiento || '01/01/1995',
          };
        }
      } catch (err) {
        this.logger.warn(`Error consultando API externa de RENIEC: ${err}. Usando padrón.`);
      }
    }

    // 3. Si coincide con nuestro catálogo conocido
    if (KNOWN_DNI_CATALOG[cleanDni]) {
      const entry = KNOWN_DNI_CATALOG[cleanDni];
      return {
        dni: cleanDni,
        ...entry,
      };
    }

    // 4. Generador determinístico realista basado en el número de DNI
    // Garantiza que cada DNI único siempre genere exactamente la misma persona peruana
    const num = parseInt(cleanDni, 10);
    const firstNameIdx = num % FIRST_NAMES.length;
    const lastName1Idx = (Math.floor(num / 13) + 7) % LAST_NAMES.length;
    let lastName2Idx = (Math.floor(num / 97) + 11) % LAST_NAMES.length;
    if (lastName1Idx === lastName2Idx) {
      lastName2Idx = (lastName2Idx + 3) % LAST_NAMES.length;
    }

    const day = (num % 28) + 1;
    const month = (Math.floor(num / 100) % 12) + 1;
    const year = 1970 + (num % 35); // 1970 a 2005

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const fechaNacimiento = `${pad(day)}/${pad(month)}/${year}`;

    return {
      dni: cleanDni,
      nombres: FIRST_NAMES[firstNameIdx],
      apellidoPaterno: LAST_NAMES[lastName1Idx],
      apellidoMaterno: LAST_NAMES[lastName2Idx],
      fechaNacimiento,
    };
  }
}
