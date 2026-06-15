import { IsEnum } from 'class-validator';
import { DocumentType } from '../../common/enums';

export class RequestUploadUrlDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;
}
