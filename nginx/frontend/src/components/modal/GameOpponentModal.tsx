import React from 'react';
import ContentBox from '../common/ContentBox';
import ModalContainer from '../container/ModalContainer';
import UserProfile from '../common/UserProfile';

interface PlayerId {
  user1Id: number;
  user2Id: number;
}

interface GameInfoModalProps {
  playerId: PlayerId;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const GameInfoModal: React.FC<GameInfoModalProps> = ({
  playerId,
  setShowModal,
}) => {
  const { user1Id, user2Id } = playerId;

  return (
    <ModalContainer setShowModal={setShowModal}>
      <div>
        <ContentBox className="space-y-6 rounded-none border-2 bg-black p-8 pb-4 shadow-md">
          <div className="flex justify-between space-x-8">
            <div className="flex flex-col items-center space-y-2">
              <UserProfile userId={user1Id} stats />
            </div>
            <div className="border-r border-white" />
            <div className="flex flex-col items-center space-y-2">
              <UserProfile userId={user2Id} stats>
                {' '}
              </UserProfile>
            </div>
          </div>
          <div className="space-x-2" />
        </ContentBox>
      </div>
    </ModalContainer>
  );
};

export default GameInfoModal;
