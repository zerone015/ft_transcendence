import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class UpdateNicknameDto {
  @IsNotEmpty()
  @IsString()
  @Length(4, 14)
  @Matches(/^[a-zA-Z0-9]+$/)
  readonly nickname: string;
}
