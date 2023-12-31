import type User from './interfaces/User';

export const isTest = false;

export const mockChannels = [
  {
    id: 1,
    title: '42seoul_other_pet',
    isLocked: true,
    newMsgCount: 0,
    memberCount: 42,
  },
  {
    id: 2,
    title: '42seoul_other_shouting',
    isLocked: false,
    newMsgCount: 42,
    memberCount: 1234,
  },
];

export const mockGames = [
  {
    roomId: 1,
    title: '1:1투혼초보테란아재만',
    isLocked: false,
    mode: false,
    isPrivate: false,
    masterId: 110729,
    participantId: undefined,
  },
  {
    roomId: 2,
    title: '1:1투혼고수만',
    isLocked: true,
    isPrivate: false,
    mode: true,
    masterId: 110729,
    participantId: 110731,
  },
];

export const mockUsers: User[] = [
  {
    id: 110729,
    nickname: 'kijsong',
    image:
      'https://cdn.intra.42.fr/users/a99b98748e81f651c11c5fa2ccbb753e/kijsong.jpg',
    status: 'online',
    winStat: 1,
    loseStat: 1,
    ladderScore: 1000,
    isBlocked: false,
    isFriend: false,
    isFriendRequest: false,
    showFriendRequest: true,
    isOwner: true,
    isAdmin: true,
  },
  {
    id: 110731,
    nickname: 'yoson',
    image:
      'https://cdn.intra.42.fr/users/40840e98c56e893af845a7d2b05e631d/yoson.jpg',
    status: 'offline',
    winStat: 1,
    loseStat: 1,
    ladderScore: 1000,
    isBlocked: true,
    isFriend: false,
    isFriendRequest: true,
    showFriendRequest: false,
    isOwner: false,
    isAdmin: true,
  },
  {
    id: 123456,
    nickname: 'wocheon',
    image:
      'https://cdn.intra.42.fr/users/bd9d267e40c02269bbdcd09fe4924419/wocheon.jpg',
    status: 'online',
    winStat: 1,
    loseStat: 1,
    ladderScore: 1000,
    isBlocked: false,
    isFriend: true,
    isFriendRequest: false,
    showFriendRequest: false,
    isOwner: false,
    isAdmin: false,
  },
];

export const mockChats = [
  {
    id: 1,
    userId: mockUsers[0].id,
    nickname: mockUsers[0].nickname,
    image: mockUsers[0].image,
    message: 'Hello, there..!',
    isSystem: true,
    createdAt: '2023-05-18 00:25:57.304419',
  },
  {
    id: 2,
    userId: mockUsers[0].id,
    nickname: mockUsers[0].nickname,
    image: mockUsers[0].image,
    message: 'Hello, there..!',
    isSystem: false,
    createdAt: '2023-05-18 00:25:57.304419',
  },
  {
    id: 3,
    userId: mockUsers[1].id,
    nickname: mockUsers[1].nickname,
    image: mockUsers[1].image,
    message: 'Hi~?',
    isSystem: false,
    createdAt: '2023-05-18 00:27:37.593432',
  },
  {
    id: 4,
    userId: mockUsers[1].id,
    nickname: mockUsers[1].nickname,
    image: mockUsers[1].image,
    message: 'How, are, you?!',
    isSystem: false,
    createdAt: '2023-05-18 00:27:44.127905',
  },
];

export const mockFriendRequests = [
  { from: mockUsers[0] },
  { from: mockUsers[1] },
  { from: mockUsers[2] },
];

export const mockGameHistory = [
  {
    isLadder: false,
    winnerNickname: mockUsers[0].nickname,
    loserNickname: mockUsers[2].nickname,
    winnerImage: mockUsers[0].image,
    loserImage: mockUsers[2].image,
    winnerScore: 5,
    loserScore: 2,
    createdAt: '2023-05-18 00:25:57.304419',
    endAt: '2023-05-18 00:27:44.127905',
  },
  {
    isLadder: false,
    winnerNickname: mockUsers[2].nickname,
    loserNickname: mockUsers[0].nickname,
    winnerImage: mockUsers[2].image,
    loserImage: mockUsers[0].image,
    winnerScore: 5,
    loserScore: 2,
    createdAt: '2023-05-18 00:25:57.304419',
    endAt: '2023-05-18 00:27:44.127905',
  },
];

export const mockLocationState = {
  interlocutorId: mockUsers[1].id,
};

export const mockRooms = [
  {
    roomId: 1,
    lastMessage: mockChats[3].message,
    lastMessageTime: mockChats[3].createdAt,
    interlocutor: mockUsers[1].nickname,
    interlocutorId: mockUsers[1].id,
    interlocutorImage: mockUsers[1].image,
    newMsgCount: 0,
  },
  {
    roomId: 2,
    lastMessage: mockChats[0].message,
    lastMessageTime: mockChats[0].createdAt,
    interlocutor: mockUsers[2].nickname,
    interlocutorId: mockUsers[2].id,
    interlocutorImage: mockUsers[2].image,
    newMsgCount: 42,
  },
];

export const mockTokenInfo = {
  id: mockUsers[0].id,
  nickname: mockUsers[0].nickname,
};

export const mockAuthState = {
  id: undefined,
  is2FA: undefined,
  accessToken: undefined,
  tokenInfo: mockTokenInfo,
};
