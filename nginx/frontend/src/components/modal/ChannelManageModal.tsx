import React, { useContext, useEffect, useState } from 'react';

import ChannelRole from '../../constants/ChannelRole';
import SocketContext from '../../context/SocketContext';
import selectAuth from '../../features/auth/authSelector';
import HoverButton from '../common/HoverButton';
import CircularImage from '../common/CircularImage';
import ContentBox from '../common/ContentBox';
import ModalContainer from '../container/ModalContainer';
import UserList from '../common/UserList';
import UserListWithSeacrhBar from '../common/UserListWithSearchBar';

import type User from '../../interfaces/User';

interface ChannelManageModalProps {
  channelId: number;
  role: number;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}

interface SendData {
  info: {
    channelId: number;
    userId: number | null;
    time: number;
  };
}

const ChannelManageModal: React.FC<ChannelManageModalProps> = ({
  channelId,
  role,
  setShowModal,
}) => {
  const { OWNER } = ChannelRole;

  const { tokenInfo } = selectAuth();
  const myId = tokenInfo?.id;

  const { socket } = useContext(SocketContext);

  const [admins, setAdmins] = useState<User[]>([]);
  const [banList, setBanList] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const sendData: SendData = {
    info: {
      channelId,
      userId: null,
      time: 30,
    },
  };

  const removeMember = () => {
    if (!selectedMember) return;
    const memberList = members.filter((member) => {
      return member.id !== selectedMember.id;
    });
    setMembers([...memberList]);
  };

  const handleAdmins = () => {
    const adminList = members.filter((member) => member.isAdmin);
    setAdmins([...adminList]);
  };

  const handleAssignAdminClick = () => {
    if (!selectedMember) return;
    socket?.emit('add-admin', sendData);
    setAdmins((prevAdmins) => [...prevAdmins, selectedMember]);
  };

  const handleBanClick = () => {
    socket?.emit('ban', sendData);
    removeMember();
  };

  const handleCloseClick = () => {
    setShowModal(false);
  };

  const handleKickClick = () => {
    socket?.emit('kick', sendData);
    removeMember();
  };

  const handleMuteClick = () => {
    socket?.emit('mute', sendData);
  };

  const handleTransferOwnerClick = () => {
    socket?.emit('transfer-ownership', sendData);
  };

  const onDeleteAdminClick = ({ id }: User) => {
    sendData.info.userId = id;
    socket?.emit('delete-admin', sendData);
    const adminList = members.filter((member) => {
      return member.id !== id;
    });
    setAdmins([...adminList]);
  };

  const onDeleteBanClick = ({ id }: User) => {
    sendData.info.userId = id;
    socket?.emit('unban', sendData);
    const newBanList = banList.filter((user) => user.id !== id);
    setBanList([...newBanList]);
  };

  const onUserClick = (user: User) => {
    setSelectedMember(user);
  };

  useEffect(() => {
    const banListHandler = (users: User[]) => {
      setBanList([...users]);
    };
    socket?.emit('find-bans', { channelId }, banListHandler);
  }, []);

  useEffect(() => {
    const membersHandler = (users: User[]) => {
      setMembers([...users.filter((user) => user.id !== myId)]);
    };
    socket?.emit('find-channel-users', { channelId }, membersHandler);
  }, []);

  useEffect(() => {
    handleAdmins();
  }, [members]);

  useEffect(() => {
    if (!selectedMember) return;
    sendData.info.userId = selectedMember.id;
  }, [selectedMember]);

  return (
    <ModalContainer setShowModal={setShowModal} className="flex space-x-8">
      <UserListWithSeacrhBar users={members} onUserClick={onUserClick} />
      {selectedMember && (
        <ContentBox className="max-h-96 max-w-xs border bg-black p-4">
          <h2 className="text-lg font-semibold">{selectedMember.nickname}</h2>
          <CircularImage
            src={selectedMember.image}
            alt={selectedMember.nickname}
            className="m-2 h-32 w-32"
          />
          <div className="m-4 flex w-full">
            <HoverButton onClick={handleMuteClick} className="w-1/3 border p-2">
              Mute
            </HoverButton>
            <HoverButton onClick={handleKickClick} className="w-1/3 border p-2">
              Kick
            </HoverButton>
            <HoverButton onClick={handleBanClick} className="w-1/3 border p-2">
              Ban
            </HoverButton>
          </div>
          {role === OWNER && (
            <div>
              <HoverButton
                onClick={handleAssignAdminClick}
                className="mb-4 w-full border p-2"
              >
                Assign Admin
              </HoverButton>
              <HoverButton
                onClick={handleTransferOwnerClick}
                className="w-full border p-2"
              >
                Transfer Owner
              </HoverButton>
            </div>
          )}
        </ContentBox>
      )}
      <div className="space-y-4">
        <div className="flex space-x-4">
          <UserList
            title="Ban"
            users={banList}
            onDeleteClick={onDeleteBanClick}
          />
          {role === OWNER && (
            <UserList
              title="Admin"
              users={admins}
              onDeleteClick={onDeleteAdminClick}
            />
          )}
        </div>
        <HoverButton onClick={handleCloseClick} className="w-full border p-2">
          Close
        </HoverButton>
      </div>
    </ModalContainer>
  );
};

export default ChannelManageModal;
