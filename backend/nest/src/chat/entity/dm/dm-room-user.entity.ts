import { User } from "src/user/entity/user.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { DmRoom } from "./dm-room.entity";

@Entity("dm_users")
export class DmUser {
  @PrimaryColumn({ name: "room_id" })
  roomId: number;

  @PrimaryColumn({ name: "user_id" })
  userId: number;

  @ManyToOne(() => DmRoom, (dmRoom) => dmRoom.roomUsers, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "room_id" })
  room: DmRoom;

  @ManyToOne(() => User, (user) => user.dmUsers, {
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ nullable: false, name: "is_exit", type: "boolean", default: false })
  isExit: boolean;

  @Column({ nullable: false, name: "new_msg_count", default: 0 })
  newMsgCount: number;

  @CreateDateColumn({
    nullable: false,
    name: "created_at",
  })
  createdAt: Date;
}
