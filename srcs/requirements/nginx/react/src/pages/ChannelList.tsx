import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import HoverButton from '../components/button/HoverButton';
import ListContainer from '../components/container/ListContainer';
import ListTitle from '../components/container/ListTitle';
import { isTest, mockChannels } from '../mock'; // test

interface ChannelListProps {
  socket: Socket;
}

export interface Channel {
  id: number;
  title: string;
  isPublic: boolean;
  newMsgCount: number;
  memberCount: number;
}

const ChannelList: React.FC<ChannelListProps> = ({ socket }) => {
  const navigate = useNavigate();

  const [channels, setChannels] = useState<Channel[]>([]);

  const handleAllChannelsClick = () => {
    navigate('/channel/all');
  };

  const handleChannelDoubleClick = ({ id }: Channel) => {
    navigate(`/channel/${id}`);
  };

  useEffect(() => {
    const channelListHandler = (channelList: Channel[]) => {
      setChannels([...channelList]);
    };
    socket.emit('find-my-channels', channelListHandler);
    setChannels(isTest ? mockChannels : channels); // test
  }, []);

  return (
    <ListContainer>
      <div className="flex items-end">
        <ListTitle className="mb-4 ml-4">Channels</ListTitle>
        <HoverButton
          onClick={handleAllChannelsClick}
          className="mb-3.5 ml-auto p-2.5 text-sm"
        >
          All Channels
        </HoverButton>
      </div>
      {channels.map((channel) => {
        const { id, title, isPublic, newMsgCount, memberCount } = channel;
        return (
          <li
            key={id}
            className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2"
            onDoubleClick={() => handleChannelDoubleClick(channel)}
          >
            <div className="flex items-center">
              {/* isPublic 아이콘 */}
              <span>{title}</span>
            </div>
            <div className="flex items-center">
              {newMsgCount > 0 && (
                <div className="mr-3 rounded-full bg-red-500 text-white">
                  {newMsgCount}
                </div>
              )}
              <span className="text-sm text-gray-600">{`${memberCount} members`}</span>
            </div>
          </li>
        );
      })}
    </ListContainer>
  );
};

export default ChannelList;
