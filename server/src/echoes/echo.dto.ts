import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListEchoesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) days = 30;
}

export class SaveEchoReflectionDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string;
}

export class UpdateEchoPreferenceDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) @MaxLength(40, { each: true }) excludedMoods?: string[];
}

export class UpdateMemoryEchoSettingDto {
  @IsBoolean() echoExcluded!: boolean;
}

export class UpdateTopicEchoSettingDto {
  @IsBoolean() echoEnabled!: boolean;
}
