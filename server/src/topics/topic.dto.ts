import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTopicDto {
  @IsString() @MinLength(1) @MaxLength(30) name!: string;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsString() @MaxLength(30) icon?: string;
  @IsOptional() @IsBoolean() isNone?: boolean;
}

export class UpdateTopicDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30) name?: string;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsString() @MaxLength(30) icon?: string;
  @IsOptional() @IsBoolean() isNone?: boolean;
  @IsOptional() @IsBoolean() suppressLongTermPrompt?: boolean;
  @IsOptional() @IsBoolean() echoEnabled?: boolean;
}

export class UpdateTopicEchoSettingDto {
  @IsBoolean() echoEnabled!: boolean;
}
