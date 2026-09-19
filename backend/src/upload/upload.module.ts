import { Module } from '@nestjs/common';
import { UploadService } from './upload.service.js';

@Module({
  providers: [UploadService],
  exports: [UploadService],
})
// eslint-disable-next-line prettier/prettier
export class UploadModule {}