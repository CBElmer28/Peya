"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReniecService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReniecService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../users/users.service");
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
const KNOWN_DNI_CATALOG = {
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
let ReniecService = ReniecService_1 = class ReniecService {
    constructor(usersService) {
        this.usersService = usersService;
        this.logger = new common_1.Logger(ReniecService_1.name);
    }
    async lookupDni(dni) {
        const cleanDni = dni.trim();
        if (cleanDni.length !== 8 || !/^\d{8}$/.test(cleanDni)) {
            throw new common_1.BadRequestException('El DNI debe contener exactamente 8 dígitos numéricos.');
        }
        const check = await this.usersService.checkDni(cleanDni);
        if (check.exists) {
            throw new common_1.ConflictException({
                statusCode: 409,
                message: 'El DNI ingresado ya se encuentra registrado en BankHub.',
                userName: check.userName || 'Usuario Registrado',
            });
        }
        if (cleanDni === '00000000' || cleanDni === '99999999') {
            throw new common_1.NotFoundException('DNI no encontrado en el padrón de RENIEC.');
        }
        const apiToken = process.env.RENIEC_API_TOKEN ||
            process.env.APIDNI_TOKEN ||
            process.env.APIS_PERU_TOKEN ||
            'sk_13927.7UZKLPyLL51riGMBeVAMcBZFNfCJSmkK';
        const apiUrl = process.env.RENIEC_API_URL ||
            process.env.DECOLECTA_API_URL ||
            'https://api.decolecta.com/v1/reniec/dni?numero=';
        try {
            const res = await fetch(`${apiUrl}${cleanDni}`, {
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                const raw = (await res.json());
                const data = raw.data && typeof raw.data === 'object' && Object.keys(raw.data).length > 0 ? raw.data : raw;
                const nombres = data.first_name ||
                    data.nombres ||
                    data.nombre ||
                    data.nombres_completos ||
                    data.nombre_completo ||
                    '';
                const apellidoPaterno = data.first_last_name ||
                    data.apellidoPaterno ||
                    data.apellido_paterno ||
                    data.paterno ||
                    '';
                const apellidoMaterno = data.second_last_name ||
                    data.apellidoMaterno ||
                    data.apellido_materno ||
                    data.materno ||
                    '';
                const fechaNacimiento = data.fechaNacimiento ||
                    data.fecha_nacimiento ||
                    data.birth_date ||
                    '01/01/1995';
                const fullName = data.full_name ||
                    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ') ||
                    '';
                if (nombres || apellidoPaterno || fullName) {
                    this.logger.log(`Consulta RENIEC en vivo exitosa para DNI ${cleanDni} vía API externa`);
                    return {
                        dni: cleanDni,
                        nombres: nombres || fullName || 'Ciudadano',
                        apellidoPaterno: apellidoPaterno || '',
                        apellidoMaterno: apellidoMaterno || '',
                        fechaNacimiento,
                    };
                }
            }
        }
        catch (err) {
            this.logger.warn(`Error consultando API externa de RENIEC: ${err}. Usando padrón.`);
        }
        if (KNOWN_DNI_CATALOG[cleanDni]) {
            const entry = KNOWN_DNI_CATALOG[cleanDni];
            return {
                dni: cleanDni,
                ...entry,
            };
        }
        const num = parseInt(cleanDni, 10);
        const firstNameIdx = num % FIRST_NAMES.length;
        const lastName1Idx = (Math.floor(num / 13) + 7) % LAST_NAMES.length;
        let lastName2Idx = (Math.floor(num / 97) + 11) % LAST_NAMES.length;
        if (lastName1Idx === lastName2Idx) {
            lastName2Idx = (lastName2Idx + 3) % LAST_NAMES.length;
        }
        const day = (num % 28) + 1;
        const month = (Math.floor(num / 100) % 12) + 1;
        const year = 1970 + (num % 35);
        const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
        const fechaNacimiento = `${pad(day)}/${pad(month)}/${year}`;
        return {
            dni: cleanDni,
            nombres: FIRST_NAMES[firstNameIdx],
            apellidoPaterno: LAST_NAMES[lastName1Idx],
            apellidoMaterno: LAST_NAMES[lastName2Idx],
            fechaNacimiento,
        };
    }
};
exports.ReniecService = ReniecService;
exports.ReniecService = ReniecService = ReniecService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], ReniecService);
//# sourceMappingURL=reniec.service.js.map