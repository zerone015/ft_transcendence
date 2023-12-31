import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import { Socket } from 'socket.io-client';

import LoginAuth from './components/login/LoginAuth';
import SocketContext from './context/SocketContext';
import dispatchAuth from './features/auth/authAction';
import selectAuth from './features/auth/authSelector';
import Layout from './Layout';
import AllChannels from './pages/AllChannels';
import BlockList from './pages/BlockList';
import Channel from './pages/Channel';
import ChannelSettings from './pages/ChannelSettings';
import DmRoom from './pages/DmRoom';
import DmRoomList from './pages/DmRoomList';
import Error from './pages/Error';
import FriendRequests from './pages/FriendRequests';
import FriendsList from './pages/FriendsList';
import GameList from './pages/GameList';
import GameRoom from './pages/GameRoom';
import GameRoomSettings from './pages/GameRoomSettings';
import GameStart from './pages/GameStart';
import Ladder from './pages/Ladder';
import Loading from './pages/Loading';
import Login from './pages/Login';
import Main from './pages/Main';
import MyChannels from './pages/MyChannels';
import MyPage from './pages/MyPage';
import ProfileSettings from './pages/ProfileSettings';
import { initSocket, initGameSocket } from './utils/initSocket';
import redirect from './utils/redirect';
import useCallApi from './utils/useCallApi';

import { isTest, mockAuthState } from './mock'; // test

const App: React.FC = () => {
  const callApi = useCallApi();
  const dispatch = useDispatch();

  const { id, is2FA, accessToken, tokenInfo } = isTest
    ? mockAuthState
    : selectAuth(); // test

  const [loading, setLoading] = useState<boolean>(false);

  let socket: Socket | null = initSocket(accessToken);
  let gameSocket: Socket | null = initGameSocket(accessToken);

  const handleLoading = async () => {
    setLoading(true);
  };

  const logout = () => {
    socket = null;
    gameSocket = null;
  };

  useEffect(() => {
    const url = new URL(window.location.href);

    const fetchAuth = async () => {
      const code = url.searchParams.get('code');
      const config = {
        url: '/api/v1/auth/social/callback/forty-two',
        method: 'post',
        data: { code },
      };
      const { data, status } = await callApi(config);
      await dispatchAuth(data, dispatch);
      const pathname = status === 201 ? '/profile-settings' : '/';
      redirect(pathname, url);
    };

    const fetchData = async () => {
      await handleLoading();
      await fetchAuth();
    };

    if (url.pathname === '/auth/social/callback/forty-two') {
      fetchData();
    }
  }, []);

  useEffect(() => {
    socket?.on('logout', logout);
  }, [socket]);

  useEffect(() => {
    gameSocket?.on('logout', logout);
  }, [gameSocket]);

  if (!tokenInfo) {
    if (is2FA) {
      return <LoginAuth id={id} />;
    }
    if (loading) {
      return <Loading />;
    }
    return <Login />;
  }

  const sockets = useMemo(() => {
    return { socket, gameSocket };
  }, [socket, gameSocket]);

  return (
    <SocketContext.Provider value={sockets}>
      <Layout>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/all-channels" element={<AllChannels />} />
          <Route path="/block-list" element={<BlockList />} />
          <Route path="/channel" element={<MyChannels />} />
          <Route path="/channel-settings" element={<ChannelSettings />} />
          <Route path="/channel/:channelId" element={<Channel />} />
          <Route path="/custom" element={<GameList />} />
          <Route path="/custom-settings" element={<GameRoomSettings />} />
          <Route path="/custom/:gameId" element={<GameRoom />} />
          <Route path="/dm" element={<DmRoomList />} />
          <Route path="/dm/:roomId" element={<DmRoom />} />
          <Route path="/friend-requests" element={<FriendRequests />} />
          <Route path="/friends-list" element={<FriendsList />} />
          <Route path="/my-page" element={<MyPage />} />
          <Route path="/profile-settings" element={<ProfileSettings />} />
          <Route path="/ladder" element={<Ladder />} />
          <Route path="/game-start" element={<GameStart />} />
          <Route path="*" element={<Error />} />
        </Routes>
      </Layout>
    </SocketContext.Provider>
  );
};

export default App;
