import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@app/database';
import { addCursorPagination, addTrgmSearch, parseCursorResult } from '@app/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SignInDto, SignInResult } from './dto/sign-in.dto';
import { ListUsersOptionsDto } from './dto/list-users-options.dto';
import { ListUsersResultDto } from './dto/list-users-result.dto';

const SALT_ROUNDS = 10;
const DEFAULT_ACCESS_EXPIRES = '15m';
const DEFAULT_REFRESH_EXPIRES = '7d';
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) { }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { userName: dto.userName } });
    if (existing) {
      throw new ConflictException('User name already registered');
    }
    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      userName: dto.userName,
      password: hashed,
      publicKey: dto.publicKey,
    });
    return this.userRepo.save(user);
  }

  /**
   * Danh sách user: search gần đúng theo userName (pg_trgm), cursor pagination (index updated_at, id).
   */
  async findAll(options: ListUsersOptionsDto = {}): Promise<ListUsersResultDto> {
    const limit = Math.min(
      Number(options.limit) || DEFAULT_PAGE_LIMIT,
      MAX_PAGE_LIMIT,
    );

    const qb = this.userRepo.createQueryBuilder('u');
    addTrgmSearch(qb, 'u', 'userName', options.search, 'userSearchTerm');
    addCursorPagination(qb, {
      alias: 'u',
      tableName: 'users',
      cursor: options.cursor,
      limit,
    });

    const items = await qb.getMany();
    return parseCursorResult(items, limit);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByUserName(userName: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { userName } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.userName !== undefined) {
      const existing = await this.userRepo.findOne({ where: { userName: dto.userName } });
      if (existing && existing.id !== id) {
        throw new ConflictException('User name already in use');
      }
      user.userName = dto.userName;
    }
    if (dto.password !== undefined && dto.password !== '') {
      user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.softRemove(user);
  }

  createAccessToken(user: UserEntity): string {
    const secret = process.env.JWT_SECRET || 'default-access-secret';
    const expiresIn = process.env.JWT_ACCESS_EXPIRES || DEFAULT_ACCESS_EXPIRES;
    return this.jwtService.sign(
      { sub: user.id, userName: user.userName },
      { secret, expiresIn },
    );
  }

  createRefreshToken(user: UserEntity): string {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-refresh-secret';
    const expiresIn = process.env.JWT_REFRESH_EXPIRES || DEFAULT_REFRESH_EXPIRES;
    return this.jwtService.sign(
      { sub: user.id, userName: user.userName },
      { secret, expiresIn },
    );
  }

  async signIn(dto: SignInDto): Promise<SignInResult> {
    const user = await this.findByUserName(dto.userName);
    if (!user) {
      throw new UnauthorizedException('Invalid user name or password');
    }
    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid user name or password');
    }
    const accessToken = this.createAccessToken(user);
    const refreshToken = this.createRefreshToken(user);
    return {
      user: { id: user.id, userName: user.userName },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Đổi refresh token còn hạn lấy access token + refresh token mới.
   * Gọi khi access token hết hạn nhưng refresh token vẫn còn hạn.
   */
  async refreshTokens(refreshToken: string): Promise<SignInResult> {
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      'default-refresh-secret';
    let payload: { sub?: string; userName?: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const accessToken = this.createAccessToken(user);
    const newRefreshToken = this.createRefreshToken(user);
    return {
      user: { id: user.id, userName: user.userName },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
