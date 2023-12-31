import { User } from "src/user/entity/user.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Channel } from "./channel.entity";

@Entity("channel_users")
export class ChannelUser {
  @PrimaryColumn({ name: "channel_id" })
  channelId: number;

  @PrimaryColumn({ name: "user_id" })
  userId: number;

  @ManyToOne(() => Channel, (channel) => channel.channelUsers, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "channel_id" })
  channel: Channel;

  @ManyToOne(() => User, (user) => user.channelUsers, {
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ nullable: false, name: "new_msg_count", default: 0 })
  newMsgCount: number;

  @Column({
    nullable: false,
    name: "is_owner",
    type: "boolean",
    default: false,
  })
  isOwner: boolean;

  @Column({
    nullable: false,
    name: "is_admin",
    type: "boolean",
    default: false,
  })
  isAdmin: boolean;

  @CreateDateColumn({
    nullable: false,
    name: "created_at",
  })
  createdAt: Date;
}
