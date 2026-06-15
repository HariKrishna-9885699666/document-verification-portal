import { IsString, IsOptional } from 'class-validator';

export class ReviewDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
