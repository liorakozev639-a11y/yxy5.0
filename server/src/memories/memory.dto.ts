import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';

export enum MemorySearchSortDto {
  RELEVANCE = 'RELEVANCE',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export enum MemorySearchMatchModeDto {
  EXACT = 'EXACT',
  FUZZY = 'FUZZY',
}

function KeywordsTotalLength(maximum: number): PropertyDecorator {
  return ValidateBy({
    name: 'keywordsTotalLength',
    constraints: [maximum],
    validator: {
      validate(value: unknown) {
        return !Array.isArray(value) || value.reduce((total, item) => total + (typeof item === 'string' ? item.length : 0), 0) <= maximum;
      },
      defaultMessage: () => `关键词总长度不能超过 ${maximum} 个字符`,
    },
  });
}

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

export class MemorySearchDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() @MaxLength(40) mood?: string;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(10) @IsString({ each: true }) statusValues?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(10) @IsString({ each: true }) topicIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(5) @IsString({ each: true }) @KeywordsTotalLength(100) keywords?: string[];
  @IsOptional() @IsEnum(MemorySearchSortDto) sort?: MemorySearchSortDto;
  @IsOptional() @IsEnum(MemorySearchMatchModeDto) matchMode?: MemorySearchMatchModeDto;
  @IsOptional() @IsString() @MaxLength(160) cursor?: string;
  @Type(() => Number) @IsInt() @Equals(5) pageSize = 5;
}

export class UpdateMemoryEchoSettingDto {
  @IsBoolean() echoExcluded!: boolean;
}

export class UpdateMemorySummarySettingDto {
  @IsBoolean() summaryExcluded!: boolean;
}
