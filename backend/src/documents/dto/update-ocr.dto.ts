import { IsObject } from 'class-validator';

export class UpdateOcrDto {
  @IsObject()
  ocrData: Record<string, any>;
}
