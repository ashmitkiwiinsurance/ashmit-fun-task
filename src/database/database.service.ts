import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';

// Without this function a deadline of 2026-12-31 comes back as 2026-12-30 in my timezone
// 1082 is the number Postgres uses for the DATE typeit mentions OID(have no idea)
function returnDateAsText(value: string) {
  return value;
}
types.setTypeParser(1082, returnDateAsText);

@Injectable()
export class DatabaseService {
  private pool: Pool;

  // Builds the connection pool from the DB_* values in .env
  constructor(configService: ConfigService) {
    this.pool = new Pool({
      host: configService.get('DB_HOST'),
      port: Number(configService.get('DB_PORT')),
      user: configService.get('DB_USER'),
      password: configService.get('DB_PASSWORD'),
      database: configService.get('DB_NAME'),
    });
  }

  // Returns the pool so services can run SQL queries
  getPool(): Pool {
    return this.pool;
  }
}
