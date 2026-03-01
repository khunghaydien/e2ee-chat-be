export interface SignInDto {
  userName: string;
  password: string;
}

export interface SignInResult {
  user: { id: string; userName: string };
  accessToken: string;
  refreshToken: string;
}
