import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'savings', enum: ['savings', 'checking', 'usd'] })
  @IsNotEmpty()
  @IsEnum(['savings', 'checking', 'usd'], { message: 'El tipo debe ser savings, checking o usd' })
  type: 'savings' | 'checking' | 'usd';

  @ApiProperty({ example: 'PEN', enum: ['PEN', 'USD'] })
  @IsNotEmpty()
  @IsEnum(['PEN', 'USD'], { message: 'La moneda debe ser PEN o USD' })
  currency: 'PEN' | 'USD';
}
