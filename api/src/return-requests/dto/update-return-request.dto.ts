import { IsIn, IsOptional, IsString } from 'class-validator';

export const RETURN_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] as const;

export class UpdateReturnRequestDto {
  @IsIn(RETURN_REQUEST_STATUSES)
  status: (typeof RETURN_REQUEST_STATUSES)[number];

  @IsOptional()
  @IsString()
  adminNote?: string;
}
