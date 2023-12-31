import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { User } from "src/user/entity/user.entity";
import { UserService } from "src/user/service/user.service";
import { setTimeout } from "timers";
import { DataSource } from "typeorm";
import { Ball, GameRoomState, GameState, gameRoomInfo } from "../dto/game.dto";
import { GameResult } from "../entity/game.entity";

const GameInfo = {
  width: 1200,
  height: 800,
  paddlex: 15,
  paddley: 120,
  maxy: (800 - 120) / 2,
  ballrad: 15,
};

@Injectable()
export class GameRoomService {
  constructor(
    private userService: UserService,
    private dataSource: DataSource
  ) {}

  private roomInfos: gameRoomInfo[] = [];
  private roomNumber = 1;

  private randomSpeed() {
    const n = Math.random();
    return (3 + n * 3) * ((Math.floor(n * 10) % 2) * 2 - 1);
  }

  private InitBallState(): Ball {
    return {
      x: 0,
      y: 0,
      dx: this.randomSpeed(),
      dy: this.randomSpeed(),
    };
  }

  makeUserState(
    user1Id: number,
    user2Id: number,
    roomState: GameRoomState,
    roomId: number
  ) {
    const userState: GameState = {
      roomId: roomId,
      user1Id: user1Id,
      user2Id: user2Id,
      paddle1: roomState.paddle1,
      paddle2: roomState.paddle2,
      ballx: roomState.ball.x,
      bally: roomState.ball.y,
      score1: roomState.score1,
      score2: roomState.score2,
    };
    return userState;
  }

  private async InitRoomState(
    user1: [number, Socket],
    user2: [number, Socket],
    player1Nickname: string,
    player2Nickname: string,
    mode: boolean,
    isLadder: boolean
  ): Promise<gameRoomInfo> {
    const roomId = this.roomNumber++;
    const roomInfo: gameRoomInfo = {
      roomId: roomId,
      mode: mode,
      isLadder: isLadder,
      user1: user1,
      user2: user2,
      player1Nickname: player1Nickname,
      player2Nickname: player2Nickname,
      state: {
        keyState1: 0,
        keyState2: 0,
        paddle1: 0,
        paddle2: 0,
        ball: this.InitBallState(),
        score1: 0,
        score2: 0,
      },
      createAt: new Date(),
      endAt: new Date(),
      broadcast: null,
    };
    return roomInfo;
  }

  makeStartState(roomInfo: gameRoomInfo) {
    const StartState: GameState = {
      roomId: roomInfo.roomId,
      user1Id: roomInfo.user1[0],
      user2Id: roomInfo.user2[0],
      paddle1: roomInfo.state.paddle1,
      paddle2: roomInfo.state.paddle2,
      ballx: roomInfo.state.ball.x,
      bally: roomInfo.state.ball.y,
      score1: roomInfo.state.score1,
      score2: roomInfo.state.score2,
    };
    return StartState;
  }

  async createRoom(
    user1: [number, Socket],
    user2: [number, Socket],
    mode: boolean,
    isLadder: boolean
  ) {
    const player1 = await this.userService.findOne(user1[0]);
    const player2 = await this.userService.findOne(user2[0]);
    await this.userService.updateStatus(player1.id);
    await this.userService.updateStatus(player2.id);

    const roomInfo: gameRoomInfo = await this.InitRoomState(
      user1,
      user2,
      player1.nickname,
      player2.nickname,
      mode,
      isLadder
    );
    const roomId = roomInfo.roomId;

    const startState: GameState = this.makeStartState(roomInfo);
    user1[1].emit("game-start", startState);
    user2[1].emit("game-start", startState);

    let timerId: NodeJS.Timeout | null;

    let intervalId = setInterval(() => {
      if (user1[1].disconnected === undefined || user1[1].disconnected) {
        if (timerId) {
          clearTimeout(timerId);
          startState.score1 = 0;
          startState.score2 = 5;
          this.endGame(roomInfo, startState, 5, 0);
          clearInterval(intervalId);
        }
      } else if (user2[1].disconnected === undefined || user2[1].disconnected) {
        if (timerId) {
          clearTimeout(timerId);
          startState.score1 = 5;
          startState.score2 = 0;
          this.endGame(roomInfo, startState, 5, 0);
          clearInterval(intervalId);
        }
      }
    }, 50);

    timerId = setTimeout(() => {
      clearInterval(intervalId);
      this.broadcastState = this.broadcastState.bind(this);
      this.roomInfos[roomId] = roomInfo;
      const broadcast = setInterval(
        this.broadcastState,
        20,
        this.roomInfos[roomId]
      );
      this.roomInfos[roomId].broadcast = broadcast;
    }, 3000);
  }

  broadcastState(roomInfo: gameRoomInfo) {
    const { roomId, user1, user2, state, mode } = roomInfo;

    state.paddle1 += state.keyState1 * 4 * 3;
    state.paddle2 += state.keyState2 * 4 * 3;

    if (state.paddle1 > GameInfo.maxy) state.paddle1 = GameInfo.maxy;
    else if (state.paddle1 < -GameInfo.maxy) state.paddle1 = -GameInfo.maxy;
    if (state.paddle2 > GameInfo.maxy) state.paddle2 = GameInfo.maxy;
    else if (state.paddle2 < -GameInfo.maxy) state.paddle2 = -GameInfo.maxy;

    state.ball.x += state.ball.dx * 1.5;
    state.ball.y += state.ball.dy * 1.5;

    if (mode === false) {
      if (
        state.ball.y >= GameInfo.height / 2 - GameInfo.ballrad &&
        state.ball.dy > 0
      ) {
        state.ball.dy *= -1;
        state.ball.y =
          (GameInfo.height / 2 - GameInfo.ballrad) * 2 - state.ball.y;
      } else if (
        state.ball.y <= -(GameInfo.height / 2 - GameInfo.ballrad) &&
        state.ball.dy < 0
      ) {
        state.ball.dy *= -1;
        state.ball.y = -(
          (GameInfo.height / 2 - GameInfo.ballrad) * 2 +
          state.ball.y
        );
      }
    } else {
      if (
        state.ball.y >= GameInfo.height / 2 - GameInfo.ballrad &&
        state.ball.dy > 0
      ) {
        state.ball.y =
          -(GameInfo.height / 2 - GameInfo.ballrad) * 2 + state.ball.y;
      } else if (
        state.ball.y <= -(GameInfo.height / 2 - GameInfo.ballrad) &&
        state.ball.dy < 0
      ) {
        state.ball.y =
          (GameInfo.height / 2 - GameInfo.ballrad) * 2 + state.ball.y;
      }
    }

    if (
      state.ball.x <=
        -(GameInfo.width / 2 - GameInfo.paddlex - GameInfo.ballrad) &&
      state.paddle1 - GameInfo.paddley / 2 <= state.ball.y &&
      state.paddle1 + GameInfo.paddley / 2 >= state.ball.y &&
      state.ball.dx < 0
    ) {
      state.ball.x = -(
        (GameInfo.width / 2 - GameInfo.paddlex - GameInfo.ballrad) * 2 +
        state.ball.x
      );
      state.ball.dx *= -1;
    } else if (
      state.ball.x >=
        GameInfo.width / 2 - GameInfo.paddlex - GameInfo.ballrad &&
      state.paddle2 - GameInfo.paddley / 2 <= state.ball.y &&
      state.paddle2 + GameInfo.paddley / 2 >= state.ball.y &&
      state.ball.dx > 0
    ) {
      state.ball.x =
        (GameInfo.width / 2 - GameInfo.paddlex - GameInfo.ballrad) * 2 -
        state.ball.x;
      state.ball.dx *= -1;
    }

    if (state.ball.x >= GameInfo.width / 2 - GameInfo.ballrad) {
      state.score1 += 1;
      state.paddle1 = 0;
      state.paddle2 = 0;
      state.keyState1 = 0;
      state.keyState2 = 0;
      state.ball = this.InitBallState();
    } else if (state.ball.x <= -(GameInfo.width / 2 - GameInfo.ballrad)) {
      state.score2 += 1;
      state.paddle1 = 0;
      state.paddle2 = 0;
      state.keyState1 = 0;
      state.keyState2 = 0;
      state.ball = this.InitBallState();
    }

    const userGameRoomState: GameState = this.makeUserState(
      user1[0],
      user2[0],
      state,
      roomId
    );

    if (user1[1].disconnected === undefined || user1[1].disconnected) {
      userGameRoomState.score1 = 0;
      userGameRoomState.score2 = 5;
      this.endGame(roomInfo, userGameRoomState, 5, 0);
    } else if (user2[1].disconnected === undefined || user2[1].disconnected) {
      userGameRoomState.score1 = 5;
      userGameRoomState.score2 = 0;
      this.endGame(roomInfo, userGameRoomState, 5, 0);
    }

    if (state.score1 >= 5) {
      this.endGame(
        roomInfo,
        userGameRoomState,
        userGameRoomState.score1,
        userGameRoomState.score2
      );
    } else if (state.score2 >= 5) {
      this.endGame(
        roomInfo,
        userGameRoomState,
        userGameRoomState.score2,
        userGameRoomState.score1
      );
    }
    user1[1].emit("game-state", userGameRoomState);
    user2[1].emit("game-state", userGameRoomState);
  }

  private async endGame(
    roomInfo: gameRoomInfo,
    userGameRoomState: GameState,
    winScore: number,
    loseScore: number
  ) {
    const { roomId, user1, user2, broadcast } = roomInfo;
    user1[1].emit("game-end", userGameRoomState);
    user2[1].emit("game-end", userGameRoomState);
    clearInterval(broadcast);

    this.roomInfos[roomId] = null;
    if (userGameRoomState.score1 === winScore) {
      const winUserId = userGameRoomState.user1Id;
      const loseUserId = userGameRoomState.user2Id;
      await this.gameResult(
        winUserId,
        loseUserId,
        roomInfo,
        winScore,
        loseScore
      );
    } else if (userGameRoomState.score2 === winScore) {
      const winUserId = userGameRoomState.user2Id;
      const loseUserId = userGameRoomState.user1Id;
      await this.gameResult(
        winUserId,
        loseUserId,
        roomInfo,
        winScore,
        loseScore
      );
    }
  }

  calculateLadderScore(): number {
    const min = 13;
    const max = 21;

    const randomValue = Math.floor(Math.random() * (max - min) + min);
    return randomValue;
  }

  async gameResult(
    winUserId: number,
    loseUserId: number,
    roomInfo: gameRoomInfo,
    winnerScore: number,
    loserScore: number
  ) {
    const { isLadder, createAt, endAt } = roomInfo;
    const win = await this.userService.findOneOrFail(winUserId);
    const lose = await this.userService.findOneOrFail(loseUserId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.insert(GameResult, {
        isLadder,
        winner: {
          id: win.id,
        },
        loser: {
          id: lose.id,
        },
        winnerScore,
        loserScore,
        createdAt: createAt,
        endAt,
      });
      await queryRunner.manager.update(
        User,
        {
          id: win.id,
        },
        {
          winStat: win.winStat + 1,
          ladderScore: isLadder
            ? win.ladderScore + this.calculateLadderScore()
            : win.ladderScore,
          status: win.socketId && win.gameSocketId ? "online" : "offline",
        }
      );
      await queryRunner.manager.update(
        User,
        {
          id: lose.id,
        },
        {
          loseStat: lose.loseStat + 1,
          ladderScore: isLadder
            ? lose.ladderScore - this.calculateLadderScore()
            : lose.ladderScore,
          status: lose.socketId && lose.gameSocketId ? "online" : "offline",
        }
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  handleKeyState(
    client: Socket,
    keyInfo: {
      roomId: number;
      message: string;
    }
  ) {
    const roomInfo: gameRoomInfo = this.roomInfos[keyInfo.roomId];
    if (roomInfo) {
      if (roomInfo.user1[1] === client) {
        if (keyInfo.message === "arrowUp") {
          roomInfo.state.keyState1--;
        } else if (keyInfo.message === "arrowDown") {
          roomInfo.state.keyState1++;
        } else if (keyInfo.message === "keyUnPressed") {
          roomInfo.state.keyState1 = 0;
        }
      } else if (roomInfo.user2[1] === client) {
        if (keyInfo.message === "arrowUp") {
          roomInfo.state.keyState2--;
        } else if (keyInfo.message === "arrowDown") {
          roomInfo.state.keyState2++;
        } else if (keyInfo.message === "keyUnPressed") {
          roomInfo.state.keyState2 = 0;
        }
      }
    }
  }

  async handleGameLeave(
    userId: number,
    client: Socket,
    smallRoomInfo: {
      roomId: number;
      user1Id: number;
      user2Id: number;
    }
  ) {
    const user = await this.userService.findOne(userId);
    const roomInfo = this.roomInfos[smallRoomInfo.roomId];
    if (!roomInfo) {
      return;
    }
    const state: GameState = {
      roomId: smallRoomInfo.roomId,
      user1Id: smallRoomInfo.user1Id,
      user2Id: smallRoomInfo.user2Id,
      paddle1: 0,
      paddle2: 0,
      ballx: 0,
      bally: 0,
      score1: 0,
      score2: 0,
    };
    if (user.id === smallRoomInfo.user1Id) {
      state.score1 = 0;
      state.score2 = 5;
      this.endGame(roomInfo, state, 5, 0);
    } else if (user.id === smallRoomInfo.user2Id) {
      state.score2 = 0;
      state.score1 = 5;
      this.endGame(roomInfo, state, 5, 0);
    }
  }

  clear(userId: number): void {
    for (let i = 0; i < this.roomInfos.length; i++) {
      if (this.roomInfos[i]?.user1[0] === userId) {
        const state: GameState = {
          roomId: this.roomInfos[i].roomId,
          user1Id: this.roomInfos[i].user1[0],
          user2Id: this.roomInfos[i].user2[0],
          paddle1: 0,
          paddle2: 0,
          ballx: 0,
          bally: 0,
          score1: 0,
          score2: 5,
        };
        this.endGame(this.roomInfos[i], state, 0, 5);
        break;
      } else if (this.roomInfos[i]?.user2[0] === userId) {
        const state: GameState = {
          roomId: this.roomInfos[i].roomId,
          user1Id: this.roomInfos[i].user1[0],
          user2Id: this.roomInfos[i].user2[0],
          paddle1: 0,
          paddle2: 0,
          ballx: 0,
          bally: 0,
          score1: 5,
          score2: 0,
        };
        this.endGame(this.roomInfos[i], state, 5, 0);
        break;
      }
    }
  }
}
