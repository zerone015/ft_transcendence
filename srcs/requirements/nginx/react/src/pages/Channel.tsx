import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import ChannelMemberList from '../components/channel/ChannelMemberList';
import ChatRoom from '../components/chat/ChatRoom';
import HoverButton from '../components/common/HoverButton';
import ChannelInviteModal from '../components/modal/ChannelInviteModal';
import selectSocket from '../features/socket/socketSelector';

const Channel: React.FC = () => {
  const { state } = useLocation();
  const password = state?.password;

  const navigate = useNavigate();

  const { channelId: channelIdString } = useParams<{ channelId: string }>();
  const channelId = Number(channelIdString);

  const { socket } = selectSocket();

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);

  const join = {
    name: 'join-channel',
    data: { info: { channelId, password } },
  };

  const leave = {
    name: 'leave-channel',
    data: { channelId },
  };

  const send = {
    name: 'send-channel',
    data: { channelId },
  };

  const exitChannel = (alert?: string) => {
    navigate('/channel', {
      state: { alert },
    });
  };

  const handleExitClick = () => {
    socket?.emit('exit', { channelId });
    exitChannel();
  };

  const handleInviteClick = () => {
    setShowInviteModal(true);
  };

  const handleSettingsClick = () => {
    navigate('/channel-settings', {
      state: { channelId },
    });
  };

  useEffect(() => {
    const banHandler = () => {
      exitChannel('You are banned.');
    };
    const kickHandler = () => {
      exitChannel('You are kicked.');
    };
    socket?.on('banned-channel', banHandler);
    socket?.on('kicked-channel', kickHandler);
    return () => {
      socket?.off('banned-channel', banHandler);
      socket?.off('kicked-channel', kickHandler);
    };
  }, []);

  return (
    <div className="flex space-x-1 px-4">
      <ChannelMemberList />
      <div className="w-full max-w-[1024px]">
        <div className="flex justify-between space-x-1.5 px-4">
          <HoverButton onClick={handleSettingsClick} className="border p-1.5">
            Settings
          </HoverButton>
          <div className="space-x-1.5">
            <HoverButton
              onClick={handleInviteClick}
              className="border bg-blue-800 p-1.5 hover:text-blue-800"
            >
              Invite
            </HoverButton>
            <HoverButton
              onClick={handleExitClick}
              className="border bg-red-800 p-1.5 hover:text-red-800"
            >
              Exit
            </HoverButton>
          </div>
        </div>
        <ChatRoom join={join} leave={leave} send={send} />
      </div>
      {showInviteModal && (
        <ChannelInviteModal setShowModal={setShowInviteModal} />
      )}
    </div>
  );
};

export default Channel;
