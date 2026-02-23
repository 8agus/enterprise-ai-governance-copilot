import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap();
