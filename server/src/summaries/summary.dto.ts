import { IsBoolean, IsOptional } from 'class-validator';

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
