import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class UsersService {
  private databaseService: DatabaseService;
  private configService: ConfigService;

  constructor(
    databaseService: DatabaseService,
    configService: ConfigService,
  ) {
    this.databaseService = databaseService;
    this.configService = configService;
  }

  // this reates a new user and returns it without the password hash
  async registerUser(dto: RegisterUserDto) {
    const pool = this.databaseService.getPool();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      dto.email,
    ]);
    if (existing.rows.length > 0) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [dto.name, dto.email, passwordHash],
    );
    return created.rows[0];
  }

  // Checks email and password and then returns a signed login token
  async login(dto: LoginDto) {
    const pool = this.databaseService.getPool();

    const found = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [dto.email],
    );
    if (found.rows.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = found.rows[0];
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const secret = this.configService.get('JWT_SECRET');
    const expiresIn = this.configService.get('JWT_EXPIRES_IN');
    const token = jwt.sign({ id: user.id, email: user.email }, secret, {
      expiresIn: expiresIn,
    });
    return { token };
  }
}
