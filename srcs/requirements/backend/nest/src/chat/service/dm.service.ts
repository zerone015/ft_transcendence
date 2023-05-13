import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "src/user/entity/user.entity";
import {
  Repository,
  SelectQueryBuilder,
  MoreThanOrEqual,
  DataSource,
} from "typeorm";
import { DmChatResponseDto } from "../dto/dm-chats-response.dto";
import { DmRoomsResponseDto } from "../dto/dm-rooms-response.dto";
import { DmBlocklistEntity } from "../entity/dm-blocklist.entity";
import { DmChatEntity } from "../entity/dm-chat.entity";
import { DmRoomUserEntity } from "../entity/dm-room-user.entity";
import { DmRoomEntity } from "../entity/dm-room.entity";

@Injectable()
export class DmService {
  constructor(
    @InjectRepository(DmRoomEntity)
    private readonly roomRepository: Repository<DmRoomEntity>,
    @InjectRepository(DmRoomUserEntity)
    private readonly roomUserRepository: Repository<DmRoomUserEntity>,
    @InjectRepository(DmChatEntity)
    private readonly chatRepository: Repository<DmChatEntity>,
    @InjectRepository(DmBlocklistEntity)
    private readonly dmBlocklistRepository: Repository<DmBlocklistEntity>,
    private readonly dataSource: DataSource
  ) {}

  async findRooms(userId: number): Promise<DmRoomsResponseDto[]> {
    const scalarSubQuery = this.roomUserRepository
      .createQueryBuilder()
      .select("has_new_msg")
      .where("user_id = :userId")
      .andWhere("room_id = dm_chats.room_id")
      .setParameter("userId", userId)
      .getQuery();

    const queryBuilder = this.chatRepository
      .createQueryBuilder("dm_chats")
      .select([
        'dm_chats.room_id       AS "roomId"',
        'dm_chats.message       AS "lastMessage"',
        'dm_chats.created_at    AS "lastMessageTime"',
        'users.id               AS "interlocutorId"',
        "users.nickname         AS interlocutor",
        'users.image            AS "interlocutorImage"',
        `CASE WHEN (${scalarSubQuery})
              THEN 'true'
              ELSE 'false' END  AS "hasNewMsg"`,
      ])
      .innerJoin(
        (inlineViewBuilder: SelectQueryBuilder<DmChatEntity>) =>
          inlineViewBuilder
            .select("sub_dm_chats.room_id", "room_id")
            .addSelect("MAX(sub_dm_chats.created_at)", "max_created_at")
            .from(DmChatEntity, "sub_dm_chats")
            .innerJoin(
              DmRoomUserEntity,
              "room_users",
              "room_users.user_id = :userId AND room_users.is_exit = false AND room_users.room_id = sub_dm_chats.room_id",
              { userId }
            )
            .groupBy("sub_dm_chats.room_id"),
        "last_chats",
        "dm_chats.room_id = last_chats.room_id AND dm_chats.created_at = last_chats.max_created_at"
      )
      .innerJoin(
        DmRoomUserEntity,
        "room_users",
        "dm_chats.room_id = room_users.room_id AND room_users.user_id != :userId",
        { userId }
      )
      .innerJoin(UserEntity, "users", "room_users.user_id = users.id")
      .orderBy("dm_chats.created_at", "DESC");

    return await queryBuilder.getRawMany<DmRoomsResponseDto>();
  }

  async findRoomUser(
    userId: number,
    interlocutorId: number
  ): Promise<DmRoomUserEntity> {
    const queryBuilder = this.roomUserRepository
      .createQueryBuilder("room_user")
      .select()
      .innerJoin(
        (inlineViewBuilder) =>
          inlineViewBuilder
            .select("d.room_id")
            .from(DmRoomUserEntity, "d")
            .where("d.user_id IN (:userId, :interlocutorId)")
            .setParameters({ userId, interlocutorId })
            .groupBy("d.room_id")
            .having("COUNT(DISTINCT d.user_id) = 2"),
        "match_room_user",
        "room_user.room_id = match_room_user.room_id"
      )
      .leftJoinAndSelect("room_user.room", "room")
      .where("room_user.user_id = :userId", { userId });

    return await queryBuilder.getOneOrFail();
  }

  async updateRoomUser(roomUser: DmRoomUserEntity): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const roomId: number = roomUser.room.id;
      const userId: number = roomUser.user.id;

      if (roomUser.hasNewMsg) {
        const findOptions: Object = {
          room: { id: roomId },
          user: { id: userId },
        };
        await this.roomUserRepository.update(findOptions, {
          hasNewMsg: false,
        });
      }
      if (roomUser.isExit) {
        await this.roomUserRepository.update(roomId, {
          isExit: false,
          createdAt: new Date(),
        });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createRoom(
    userId: number,
    interlocutorId: number
  ): Promise<DmRoomUserEntity> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const newRoom: DmRoomEntity = await this.roomRepository.save(
        new DmRoomEntity()
      );
      const newRoomUsers: DmRoomUserEntity[] =
        await this.roomUserRepository.save([
          {
            room: {
              id: newRoom.id,
            },
            user: {
              id: userId,
            },
          },
          {
            room: {
              id: newRoom.id,
            },
            user: {
              id: interlocutorId,
            },
          },
        ]);

      await queryRunner.commitTransaction();
      return newRoomUsers.find((newRoomUser) => newRoomUser.user.id === userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findChats(roomUser: DmRoomUserEntity): Promise<DmChatResponseDto[]> {
    const dmChats: DmChatEntity[] = await this.chatRepository.find({
      relations: {
        user: true,
        room: true,
      },
      where: {
        room: {
          id: roomUser.room.id,
        },
        createdAt: MoreThanOrEqual(roomUser.createdAt),
      },
      order: {
        createdAt: "ASC",
      },
    });

    return dmChats.map((dmChat) => {
      return new DmChatResponseDto(dmChat);
    });
  }

  async isBlocked(from: number, to: number): Promise<boolean> {
    return (await this.dmBlocklistRepository.countBy({
      userId: from,
      blockedUserId: to,
    }))
      ? true
      : false;
  }

  async saveChat(
    senderId: number,
    roomId: number,
    message: string,
    recipientId: number,
    isNotJoin: boolean
  ): Promise<DmChatEntity> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const newChat: DmChatEntity = await this.chatRepository.save({
        user: {
          id: senderId,
        },
        room: {
          id: roomId,
        },
        message,
      });
      if (isNotJoin) {
        const findOptions: Object = {
          room: { id: roomId },
          user: { id: recipientId },
        };
        await this.roomUserRepository.update(findOptions, {
          hasNewMsg: true,
        });
      }
      await queryRunner.commitTransaction();

      return newChat;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findChat(id: number): Promise<DmChatResponseDto> {
    const DmChat: DmChatEntity = await this.chatRepository.findOne({
      relations: {
        user: true,
        room: true,
      },
      where: {
        id: id,
      },
    });
    return new DmChatResponseDto(DmChat);
  }

  async findRoomUsers(id: number): Promise<DmRoomUserEntity[]> {
    return await this.roomUserRepository.findBy({
      room: {
        id: id,
      },
    });
  }

  async deleteRoom(id: number): Promise<void> {
    await this.roomRepository.delete(id);
  }

  async exitRoom(roomId: number, userId: number): Promise<void> {
    const findOptions: Object = { room: { id: roomId }, user: { id: userId } };
    await this.roomUserRepository.update(findOptions, {
      isExit: true,
    });
  }
}
