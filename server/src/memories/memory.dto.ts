import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMemoryDto {
  @IsString() mediaId!: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) note?: string;
  @IsOptional() @IsString() @MaxLength(40) mood?: string;
  @IsOptional() @IsISO8601() eventAt?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) statuses?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) topics?: string[];
}

export class UpdateMemoryDto {
  @IsOptional() @IsString() mediaId?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) note?: string;
  @IsOptional() @IsString() @MaxLength(40) mood?: string;
  @IsOptional() @IsISO8601() eventAt?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) statuses?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) topics?: string[];
}

export class MemoryFilterDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class UpdateMemoryEchoSettingDto {
  @IsBoolean() echoExcluded!: boolean;
}
