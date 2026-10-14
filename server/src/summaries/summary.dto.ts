import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type { StoryPeriodType } from './summary-story.types.js';

@ValidatorConstraint({ name: 'periodKeyMatchesType', async: false })
class PeriodKeyMatchesTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, validationArgs: ValidationArguments) {
    const periodType = (validationArgs.object as { periodType?: StoryPeriodType }).periodType;
    if (typeof value !== 'string') return false;
    return periodType === 'MONTH'
      ? /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      : periodType === 'YEAR' && /^\d{4}$/.test(value);
  }

  defaultMessage() { return 'periodKey 与 periodType 不匹配'; }
}

export class GenerateSummaryDto {
  @IsEnum(['MONTH', 'YEAR']) periodType!: StoryPeriodType;
  @IsString() @Validate(PeriodKeyMatchesTypeConstraint) periodKey!: string;
}

export class ListSummariesQueryDto {
  @IsOptional() @IsEnum(['MONTH', 'YEAR']) periodType?: StoryPeriodType;
  /** Legacy statistics query fields; removed after the frontend migration. */
  @IsOptional() @IsString() period?: string;
  @IsOptional() @IsString() date?: string;
}

export class UpdateSummaryProgressDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(0) @Max(200) page!: number;
  @IsOptional() @IsBoolean() viewed?: boolean;
}

export class UpdateSummaryPageDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(4000) narration?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) @Max(200) displayOrder?: number;
}

export class SaveSummaryReflectionDto {
  @IsString() @MaxLength(2000) text!: string;
  @IsOptional() @IsString() coverMediaId?: string;
}

export class UpdateSummaryPreferenceDto {
  @IsBoolean() reviewed!: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() allowText?: boolean;
  @IsOptional() @IsBoolean() allowPhotos?: boolean;
  @IsOptional() @IsBoolean() allowCloudAi?: boolean;
}

export type SummaryPreferenceInput = {
  reviewed?: boolean;
  enabled?: boolean;
  allowText?: boolean;
  allowPhotos?: boolean;
  allowCloudAi?: boolean;
};

export type GenerateSummaryInput = { periodType: StoryPeriodType; periodKey: string };
export type UpdateSummaryProgressInput = { version: number; page: number; viewed?: boolean };
export type UpdateSummaryPageInput = { version: number; narration?: string; payload?: Record<string, unknown>; displayOrder?: number };
export type SaveSummaryReflectionInput = { text: string; coverMediaId?: string };
