import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ReniecService } from './reniec.service';

@ApiTags('Identidad & RENIEC (HU1)')
@Controller('reniec')
export class ReniecController {
  constructor(private readonly reniecService: ReniecService) {}

  @Get('dni/:numero')
  @ApiOperation({ summary: 'Consultar información de identidad por número de DNI' })
  @ApiParam({ name: 'numero', example: '48219032', description: 'DNI de 8 dígitos' })
  @ApiResponse({ status: 200, description: 'Datos oficiales del ciudadano obtenidos con éxito.' })
  @ApiResponse({ status: 400, description: 'Formato de DNI inválido.' })
  @ApiResponse({ status: 409, description: 'El DNI ya se encuentra registrado en el sistema.' })
  async lookupDni(@Param('numero') numero: string) {
    return this.reniecService.lookupDni(numero);
  }
}
