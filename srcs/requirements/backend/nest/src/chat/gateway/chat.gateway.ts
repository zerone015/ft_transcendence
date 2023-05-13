import { UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UserEntity } from "src/user/entity/user.entity";
import { UserService } from "src/user/service/user.service";
import { DmChatResponseDto } from "../dto/dm-chats-response.dto";
import { DmRoomsResponseDto } from "../dto/dm-rooms-response.dto";
import { DmRoomUserEntity } from "../entity/dm-room-user.entity";
import { WsJwtAccessGuard } from "../guard/ws-jwt-access.guard";
import { DmService } from "../service/dm.service";
import { ConnectionService } from "../service/connection.service";
import { DisconnectionService } from "../service/disconnection.service";
import { WsJwtPayload } from "../utils/ws-jwt-payload.decorator";
import { JwtPayload } from "jsonwebtoken";

@WebSocketGateway(80, {
  cors: {
    origin: [`https://${process.env.HOST_NAME}`],
    credentials: true,
  },
})
@UseGuards(WsJwtAccessGuard)
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly disconnectionService: DisconnectionService,
    private readonly dmService: DmService,
    private readonly userService: UserService
  ) {}

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    this.disconnectionService.updateUserInfo(client.id);
  }

  @SubscribeMessage("connection")
  async connectClient(
    @WsJwtPayload() jwt: JwtPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.connectionService.updateUserInfo(jwt.id, client.id);
  }

  @SubscribeMessage("find-dm-rooms")
  async findDmRooms(
    @WsJwtPayload() jwt: JwtPayload
  ): Promise<DmRoomsResponseDto[]> {
    return await this.dmService.findRooms(jwt.id);
  }

  @SubscribeMessage("join-dm")
  async joinDM(
    @WsJwtPayload() jwt: JwtPayload,
    @ConnectedSocket() client: Socket,
    @MessageBody("interlocutorId") interlocutorId: number
  ): Promise<Object> {
    let roomUser: DmRoomUserEntity;
    try {
      roomUser = await this.dmService.findRoomUser(jwt.id, interlocutorId); // An exception can occur
      await this.dmService.updateRoomUser(roomUser);
    } catch (EntityNotFoundError) {
      roomUser = await this.dmService.createRoom(jwt.id, interlocutorId);
    }
    const chats: DmChatResponseDto[] = await this.dmService.findChats(roomUser);
    const roomId = roomUser.room.id;

    client.join("d" + roomId);

    return { roomId, chats };
  }

  @SubscribeMessage("send-dm")
  async sendDM(
    @WsJwtPayload() jwt: JwtPayload,
    @MessageBody("to") to: { userId: number; roomId: number },
    @MessageBody("message") message: string
  ): Promise<DmChatResponseDto> {
    try {
      const recipient: UserEntity = await this.userService.findUserById(
        to.userId
      ); // An exception can occur

      if (await this.dmService.isBlocked(jwt.id, recipient.id)) {
        throw new WsException(
          "You can't send a message to the user you have blocked."
        );
      }
      if (await this.dmService.isBlocked(recipient.id, jwt.id)) {
        throw new WsException(
          "You can't send a message because you have been blocked."
        );
      }

      const roomSockets = await this.server.in("d" + to.roomId).fetchSockets();
      const isOffline = recipient.status === "offline";
      const isNotJoin = isOffline
        ? true
        : !roomSockets.find((socket) => socket.id === recipient.socketId);

      const { id: chatId } = await this.dmService.saveChat(
        jwt.id,
        to.roomId,
        message,
        recipient.id,
        isNotJoin
      );
      const chat: DmChatResponseDto = await this.dmService.findChat(chatId);

      if (!isOffline) {
        const recipientSocket = await this.server
          .in(recipient.socketId)
          .fetchSockets();
        recipientSocket[0].emit("send-dm", chat);
      }
      return chat;
    } catch (error) {
      throw error;
    }
  }

  @SubscribeMessage("leave-dm")
  async leaveDM(
    @ConnectedSocket() client: Socket,
    @MessageBody("roomId") roomId: number
  ): Promise<void> {
    client.leave("d" + roomId);
  }

  @SubscribeMessage("delete-dm-room")
  async deleteDmRoom(
    @WsJwtPayload() jwt: JwtPayload,
    @ConnectedSocket() client: Socket,
    @MessageBody("roomId") roomId: number
  ): Promise<void> {
    const roomUsers: DmRoomUserEntity[] = await this.dmService.findRoomUsers(
      roomId
    );
    if (!roomUsers.find((roomUser) => roomUser.user.id === jwt.id)) {
      throw new WsException("Entity not found");
    }
    client.leave("d" + roomId);
    const interlocutorRoomUser = roomUsers.find(
      (roomUser) => roomUser.user.id !== jwt.id
    );
    if (interlocutorRoomUser.isExit) {
      await this.dmService.deleteRoom(roomId);
      return;
    }
    await this.dmService.exitRoom(roomId, jwt.id);
  }
}
