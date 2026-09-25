import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  private usersService: UsersService;

  constructor(usersService: UsersService) {
    this.usersService = usersService;
  }

  @Post()
  register(@Body() body: RegisterUserDto) {
    return this.usersService.registerUser(body);
  }

  //this handles POST /users/login: and then  passes the request body to the service
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.usersService.login(body);
  }
}
