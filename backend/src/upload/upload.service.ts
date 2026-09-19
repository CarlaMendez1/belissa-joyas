import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async subirImagen(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'belissa-joyas/productos' },
        (error, result) => {
          if (error || !result) {
            return reject(
              error instanceof Error
                ? error
                : new Error('Error al subir la imagen a Cloudinary'),
            );
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
