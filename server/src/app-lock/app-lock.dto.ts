import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SetupAppLockDto {
  @IsString()
  @Length(8, 128)
  password!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  autoLockMinutes?: number;
}

export class UnlockAppLockDto {
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class UpdateAppLockDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  autoLockMinutes?: number;
}

export class RecoverAppLockDto {
  @IsString()
  recoveryKey!: string;

  @IsString()
  @Length(8, 128)
  newPassword!: string;
}

export class ChangeAppLockPasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
