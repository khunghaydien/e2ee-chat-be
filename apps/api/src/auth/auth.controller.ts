import { Body, Controller, Post } from '@nestjs/common';
import {
  UsersService,
  CreateUserDto,
  SignInDto,
  SignInResult,
} from '@app/users';
import { Public } from '@app/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) { }

  @Public()
  @Post('sign-up')
  async signUp(@Body() dto: CreateUserDto): Promise<SignInResult> {
    const user = await this.usersService.create(dto);
    const accessToken = this.usersService.createAccessToken(user);
    const refreshToken = this.usersService.createRefreshToken(user);
    return {
      user: { id: user.id, userName: user.userName },
      accessToken,
      refreshToken,
    };
  }

  @Public()
  @Post('sign-in')
  async signIn(@Body() dto: SignInDto): Promise<SignInResult> {
    return this.usersService.signIn(dto);
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<SignInResult> {
    return this.usersService.refreshTokens(refreshToken);
  }
}
