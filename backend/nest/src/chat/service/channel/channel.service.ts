import { Injectable } from "@nestjs/common";
import { ChannelChat } from "src/chat/entity/channel/chat.entity";
import { ChannelUser } from "src/chat/entity/channel/channel-user.entity";
import { Channel } from "src/chat/entity/channel/channel.entity";
import * as bcryptjs from "bcryptjs";
import { DataSource, InsertResult } from "typeorm";
import { WsException } from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { BanService } from "./ban.service";
import { Ban } from "src/chat/entity/channel/ban.entity";
import { Mute } from "src/chat/entity/channel/mute.entity";
import { UserService } from "src/user/service/user.service";
import { User } from "src/user/entity/user.entity";
import { JoinResponse } from "src/chat/dto/channel/join-response";
import { SendResponse } from "src/chat/dto/channel/send-response";
import { ChannelChatService } from "./channel-chat.service";
import { ChannelRoomService } from "./channel-room.service";
import { ChannelUserService } from "./channel-user.service";
import { MyChannelResponse } from "src/chat/dto/channel/my-channel-response";
import { CreateRequest } from "src/chat/dto/channel/create-request";
import { CreateResponse } from "src/chat/dto/channel/create-response";
import { UserResponse } from "src/chat/dto/channel/user-response";
import { BanResponse } from "src/chat/dto/channel/ban-response";
import { AllChannelResponse } from "src/chat/dto/channel/all-channel-response";
import { ChannelSystemService } from "./channel-system.service";
import { ChannelVerifyService } from "./channel-verify.service";

@Injectable()
export class ChannelService {
  constructor(
    private readonly roomService: ChannelRoomService,
    private readonly channelUserService: ChannelUserService,
    private readonly chatService: ChannelChatService,
    private readonly banService: BanService,
    private readonly userService: UserService,
    private readonly systemService: ChannelSystemService,
    private readonly verifyService: ChannelVerifyService,
    private readonly dataSource: DataSource
  ) {}

  async findAllChannels(userId: number): Promise<AllChannelResponse[]> {
    return await this.roomService.findAll(userId);
  }

  async findMyChannels(userId: number): Promise<MyChannelResponse[]> {
    return await this.roomService.find(userId);
  }

  async isDuplicated(title: string): Promise<boolean> {
    const room: Channel = await this.roomService.findOneByTitle(title);
    if (room) {
      return true;
    }
    return false;
  }

  async createChannel(
    userId: number,
    body: CreateRequest
  ): Promise<CreateResponse> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { identifiers }: InsertResult = await queryRunner.manager.insert(
        Channel,
        {
          title: body.title,
          isPublic: body.isPublic,
          password:
            typeof body.password === "undefined"
              ? ""
              : await bcryptjs.hash(body.password, await bcryptjs.genSalt()),
        }
      );
      await queryRunner.manager.insert(ChannelUser, {
        channelId: identifiers[0].id,
        userId,
        isOwner: true,
        isAdmin: true,
      });

      await queryRunner.commitTransaction();

      const newChannel: Channel = await this.roomService.findOneOrFail(
        identifiers[0].id
      );
      return new CreateResponse(newChannel);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async join(
    userId: number,
    channelId: number,
    password: string,
    client: Socket,
    server: Namespace
  ): Promise<JoinResponse> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      let channelUser: ChannelUser = await queryRunner.manager.findOne(
        ChannelUser,
        {
          relations: {
            user: true,
          },
          where: {
            channelId,
            userId,
          },
        }
      );
      if (!channelUser) {
        await this.verifyService.verifyJoin(
          channelId,
          userId,
          password,
          client
        );
        await queryRunner.manager.insert(ChannelUser, {
          channelId,
          userId,
        });
        channelUser = await queryRunner.manager.findOne(ChannelUser, {
          relations: {
            user: true,
          },
          where: {
            channelId,
            userId,
          },
        });
        client.join("c" + channelId);
        const systemMessage: string = `${channelUser.user.nickname} has joined.`;
        await this.systemService.send(
          queryRunner.manager,
          userId,
          channelId,
          systemMessage,
          server
        );
      } else {
        client.join("c" + channelId);
        if (channelUser.newMsgCount > 0) {
          await queryRunner.manager.update(
            ChannelUser,
            { channelId, userId },
            {
              newMsgCount: 0,
            }
          );
        }
      }
      await queryRunner.commitTransaction();

      const chats: ChannelChat[] = await this.chatService.find(
        channelId,
        channelUser.createdAt
      );
      const channelUsers: ChannelUser[] = await this.channelUserService.find(channelId);
      return new JoinResponse(channelId, channelUser.newMsgCount, chats, channelUsers.map((channelUser) => new UserResponse(channelUser)));
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async send(
    senderId: number,
    channelId: number,
    message: string,
    client: Socket,
    server: Namespace
  ): Promise<void> {
    await this.verifyService.verifySend(channelId, senderId, client);
    const channelUsers: ChannelUser[] = await this.channelUserService.find(
      channelId
    );
    if (!channelUsers.some((channelUser) => channelUser.user.id === senderId)) {
      throw new WsException("can't send because not a member.");
    }
    const sockets = await server.in("c" + channelId).fetchSockets();
    const notJoined = channelUsers
      .filter(
        (channelUser) =>
          !sockets.some((socket) => socket.id === channelUser.user.socketId)
      )
      .map((notJoinedUser) => ({ channelId, userId: notJoinedUser.user.id }));
    const onlineSockets: string[] = channelUsers
      .filter((channelUser) => channelUser.user.status === "online")
      .map((onlineChannelUser) => onlineChannelUser.user.socketId);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { identifiers }: InsertResult = await queryRunner.manager.insert(
        ChannelChat,
        {
          user: {
            id: senderId,
          },
          channel: {
            id: channelId,
          },
          message,
          isSystem: false,
        }
      );
      if (notJoined.length > 0) {
        await queryRunner.manager.increment(
          ChannelUser,
          notJoined,
          "newMsgCount",
          1
        );
      }

      await queryRunner.commitTransaction();

      const chat: ChannelChat = await this.chatService.findOneOrFail(
        identifiers[0].id
      );
      server
        .to(onlineSockets)
        .emit("send-channel", new SendResponse(channelId, chat));
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteChannel(
    channelId: number,
    userId: number,
    client: Socket
  ): Promise<void> {
    const channelUser: ChannelUser =
      await this.channelUserService.findOneOrFail(channelId, userId);
    if (!channelUser.isOwner) {
      throw new WsException("permission denied.");
    }
    await this.roomService.delete(channelId);
    client.to("c" + channelId).emit("delete-channel", { id: channelId });
    client.emit("exit-channel");
  }

  async exit(
    channelId: number,
    userId: number,
    client: Socket,
    server: Namespace
  ): Promise<void> {
    const channelUser: ChannelUser =
      await this.channelUserService.findOneOrFail(channelId, userId);
    if (channelUser.isOwner) {
      throw new WsException(
        "The owner can't exit the channel. Please transfer ownership to another user and try again."
      );
    }
    client.leave("c" + channelId);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const primaryKey = { channelId, userId };
      const systemMessage: string = `${channelUser.user.nickname} has left`;
      
      await queryRunner.manager.delete(ChannelUser, primaryKey);
      await this.systemService.send(
        queryRunner.manager,
        userId,
        channelId,
        systemMessage,
        server
      );
      await queryRunner.commitTransaction();

      client.emit("exit-channel");
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async transferOwnership(
    userId: number,
    channelId: number,
    newOwnerId: number,
    server: Namespace
  ): Promise<void> {
    const oldOwner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      userId
    );
    if (!oldOwner.isOwner) {
      throw new WsException("permission denied.");
    }
    const newOwner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      newOwnerId
    );
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const oldOwnerPk = { channelId, userId };
      const newOwnerPk = { channelId, userId: newOwnerId };
      await queryRunner.manager.update(ChannelUser, oldOwnerPk, {
        isOwner: false,
        isAdmin: false,
      });
      await queryRunner.manager.update(ChannelUser, newOwnerPk, {
        isOwner: true,
        isAdmin: true,
      });
      const systemMessage: string = `The owner of the channel has been changed from ${oldOwner.user.nickname} to ${newOwner.user.nickname}.
      `;
      await this.systemService.send(
        queryRunner.manager,
        newOwnerId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async addAdmin(
    userId: number,
    channelId: number,
    newAdminId: number,
    server: Namespace
  ): Promise<void> {
    const owner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      userId
    );
    if (!owner.isOwner) {
      throw new WsException("permission denied.");
    }
    const newAdmin: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      newAdminId
    );

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        ChannelUser,
        { channelId, userId: newAdminId },
        {
          isAdmin: true,
        }
      );
      const systemMessage: string = `${newAdmin.user.nickname} has been granted the "admin" role.
      `;
      await this.systemService.send(
        queryRunner.manager,
        newAdminId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAdmin(
    userId: number,
    channelId: number,
    targetId: number,
    server: Namespace
  ): Promise<void> {
    const owner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      userId
    );
    const target: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      targetId
    );
    if (!owner.isOwner || target.isOwner) {
      throw new WsException("permission denied.");
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        ChannelUser,
        { channelId, userId: targetId },
        {
          isAdmin: false,
        }
      );
      const systemMessage: string = `${target.user.nickname} has been revoked the "admin" role.
      `;
      await this.systemService.send(
        queryRunner.manager,
        targetId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async invite(
    inviterId: number,
    channelId: number,
    userIds: number[],
    server: Namespace
  ): Promise<void> {
    const inviter: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      inviterId
    );
    if (await this.banService.includes(channelId, userIds)) {
      throw new WsException("can't invite the user as they have been banned.");
    }
    const invitee: User = await this.userService.findOneOrFail(userIds[0]);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.insert(
        ChannelUser,
        userIds.map((id) => ({ channelId, userId: id }))
      );
      const systemMessage: string = `${invitee.nickname} was added by ${
        inviter.user.nickname
      }. Also, ${userIds.length - 1} others joined.
      `;
      await this.systemService.send(
        queryRunner.manager,
        invitee.id,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async kick(
    userId: number,
    channelId: number,
    kickedId: number,
    server: Namespace
  ): Promise<void> {
    const kicker: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      userId
    );
    const kicked: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      kickedId
    );
    if (
      !kicker.isAdmin ||
      kicked.isOwner ||
      (!kicker.isOwner && kicked.isAdmin)
    ) {
      throw new WsException("permission denied.");
    }
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const kickedPk = {
        channelId,
        userId: kickedId,
      };
      const systemMessage: string = `${kicked.user.nickname} has been kicked by ${kicker.user.nickname}`;
      await queryRunner.manager.delete(ChannelUser, kickedPk);
      await this.systemService.send(
        queryRunner.manager,
        kickedId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();

      if (kicked.user.status === "online") {
        const kickedSocket = await server
          .to(kicked.user.socketId)
          .fetchSockets();
        kickedSocket[0].leave("c" + channelId);
        kickedSocket[0].emit("kicked-channel", { id: channelId });
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async mute(
    muterId: number,
    channelId: number,
    mutedId: number,
    time: number,
    server: Namespace
  ): Promise<void> {
    const muter: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      muterId
    );
    const muted: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      mutedId
    );
    if (!muter.isAdmin || muted.isOwner || (!muter.isOwner && muted.isAdmin)) {
      throw new WsException("permission denied.");
    }
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.upsert(
        Mute,
        {
          channelId,
          userId: mutedId,
          limitedAt: new Date(new Date().getTime() + time * 1000),
        },
        ["channelId", "userId"]
      );
      const systemMessage: string = `${muted.user.nickname} has been muted for ${time} seconds by ${muter.user.nickname}`;
      await this.systemService.send(
        queryRunner.manager,
        mutedId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();
      const sockets = await server.in("c" + channelId).fetchSockets();
      if (sockets.some((socket) => socket.id === muted.user.socketId)) {
        server.to(muted.user.socketId).emit("muted");
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async ban(
    bannerId: number,
    channelId: number,
    bannedId: number,
    server: Namespace
  ): Promise<void> {
    const banner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      bannerId
    );
    const banned: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      bannedId
    );
    if (
      !banner.isAdmin ||
      banned.isOwner ||
      (!banner.isOwner && banned.isAdmin)
    ) {
      throw new WsException("permission denied.");
    }
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.delete(ChannelUser, {
        channelId,
        userId: bannedId,
      });
      await queryRunner.manager.insert(Ban, { channelId, userId: bannedId });

      const systemMessage: string = `${banned.user.nickname} has been banned by ${banner.user.nickname}`;
      await this.systemService.send(
        queryRunner.manager,
        bannedId,
        channelId,
        systemMessage,
        server
      );

      await queryRunner.commitTransaction();

      if (banned.user.status === "online") {
        const bannedSocket = await server
          .to(banned.user.socketId)
          .fetchSockets();
        bannedSocket[0].leave("c" + channelId);
        bannedSocket[0].emit("banned-channel", { id: channelId });
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unban(
    unbannerId: number,
    channelId: number,
    unbannedId: number
  ): Promise<void> {
    const unbanner: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      unbannerId
    );
    if (!unbanner.isAdmin) {
      throw new WsException("permission denied.");
    }
    await this.banService.delete(channelId, unbannedId);
  }

  async updatePassword(userId: number, channelId: number, password: string) {
    const updater: ChannelUser = await this.channelUserService.findOneOrFail(
      channelId,
      userId
    );
    if (!updater.isOwner) {
      throw new WsException("permission denied.");
    }
    await this.roomService.updatePassword(channelId, password);
  }

  async findUsers(channelId: number): Promise<UserResponse[]> {
    const users: ChannelUser[] = await this.channelUserService.find(channelId);
    return users.map((user) => new UserResponse(user));
  }

  async findAdmins(channelId: number): Promise<UserResponse[]> {
    const admins: ChannelUser[] = await this.channelUserService.findAdmins(
      channelId
    );
    return admins.map((admin) => new UserResponse(admin));
  }

  async findBanUsers(channelId: number): Promise<BanResponse[]> {
    const bans: Ban[] = await this.banService.find(channelId);
    return bans.map((ban) => new BanResponse(ban));
  }
}
