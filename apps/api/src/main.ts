import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN?.trim() || "http://localhost:3000";

  app.enableCors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

void bootstrap();
