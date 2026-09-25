import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  //everything else needs a valid Bearer token
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const path = request.originalUrl.split('?')[0];
    if (request.method === 'POST' && (path === '/users' || path === '/users/login')) {
      return true;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = header.substring(7);
    const secret = this.configService.get('JWT_SECRET');
    try {
      request.user = jwt.verify(token, secret);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}
