import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CopyLifecycleStatus } from '@prisma/client';

export class CreateLongTermCopyDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() topicId!: string;
  @IsISO8601() startDate!: string;
  @IsOptional() @IsEnum(CopyLifecycleStatus) lifecycleStatus?: CopyLifecycleStatus;
  @IsOptional() @IsBoolean() autoCollectEnabled?: boolean;
  @IsOptional() @IsBoolean() backfill?: boolean;
}

export class UpdateLongTermCopyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsEnum(CopyLifecycleStatus) lifecycleStatus?: CopyLifecycleStatus;
  @IsOptional() @IsBoolean() autoCollectEnabled?: boolean;
}

export class TimelineQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}
