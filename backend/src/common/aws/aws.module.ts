import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { EventBridgeService } from './eventbridge.service';

@Global()
@Module({
  providers: [S3Service, EventBridgeService],
  exports: [S3Service, EventBridgeService],
})
export class AwsModule {}
