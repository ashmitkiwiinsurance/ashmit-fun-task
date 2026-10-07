import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // registers pipe then checks later requests  against DTO
  app.useGlobalPipes(
    new ValidationPipe({
      // Whitelist is an "allowed list". In ValidationPipe, whitelist: true means: only the fields the DTO declares are allowed through, and everything else is removed from the request
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  let port = 3010;
  if (process.env.PORT) {
    port = Number(process.env.PORT);
  }
  await app.listen(port);
}
// app starts here 
bootstrap();
