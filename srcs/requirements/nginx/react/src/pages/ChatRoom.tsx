import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import AlertWithCloseButton from '../components/alert/AlertWithCloseButton';
import ChatContainer from '../components/container/ChatContainer';
import CircularImage from '../components/container/CircularImage';
import Message from '../components/container/Message';
import MessageBox from '../components/container/MessageBox';
import MessageForm from '../components/container/MessageForm';

export interface Chat {
  id: number;
  roomId: string;
  userId: number;
  nickname: string;
  image: string;
  message: string;
  createdAt: string;
}

interface ChatRoomProps {
  myId: number;
  socket: Socket;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ myId, socket }) => {
  const location = useLocation();
  const { interlocutorId } = location.state;
  const { roomId } = useParams<{ roomId: string }>();

  const chatContainer = useRef<HTMLDivElement>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [message, setMessage] = useState<string>('');
  const [newMsgCount, setNewMsgCount] = useState<number>(0);
  const [showAlert, setShowAlert] = useState(false);

  const addChat = (chat: Chat) => {
    setChats((prevChats) => [...prevChats, chat]);
    setNewMsgCount(0);
  };

  const handleCloseAlert = () => {
    setShowAlert(false);
  };

  const onTextChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }, []);

  const onSendMessage = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!message) return;
      const sendDmData = { to: { id: interlocutorId, message } };
      const chatHandler = (chat: Chat) => {
        addChat(chat);
        setMessage('');
      };
      socket.emit('send-dm', sendDmData, chatHandler);
    },
    [message],
  );

  useEffect(() => {
    const chatsHandler = ({
      newMsgCount: newMsgCnt,
      chats: prevChats,
    }: {
      newMsgCount: number;
      chats: Chat[];
    }) => {
      if (showAlert) return;
      setNewMsgCount(newMsgCnt);
      setChats([...prevChats]);
    };
    socket.emit('join-dm', { interlocutorId }, chatsHandler);
    return () => {
      socket.emit('leave-dm', { roomId });
    };
  }, []);

  useEffect(() => {
    const chatHandler = (chat: Chat) => addChat(chat);
    const errorHandler = () => setShowAlert(true);
    socket.on('send-dm', chatHandler);
    socket.on('error', errorHandler);
    return () => {
      socket.off('send-dm', chatHandler);
      socket.off('error', errorHandler);
    };
  }, []);

  useEffect(() => {
    const { current } = chatContainer;
    if (!current) return;

    const { clientHeight, scrollHeight } = current;
    if (scrollHeight > clientHeight) {
      current.scrollTop = scrollHeight - clientHeight;
    }
  }, [chats.length]);

  useEffect(() => {
    if (showAlert) {
      const timeoutId = setTimeout(() => {
        setShowAlert(false);
      }, 2500);
      return () => clearTimeout(timeoutId);
    }
  }, [showAlert]);

  return (
    <>
      <h1>WebSocket Chat</h1>
      <ChatContainer ref={chatContainer}>
        {chats.map((chat, index) => {
          const isMyMessage = chat.userId === myId;
          let msgBoxClassName = '';
          let msgClassName = '';
          let nickname = '';
          if (isMyMessage) {
            msgBoxClassName = 'flex-col items-end';
            msgClassName = 'bg-yellow-300';
          } else {
            nickname = chat.nickname;
          }
          return (
            <>
              {chats.length - index === newMsgCount && (
                <div>
                  <div className="m-2 h-px w-full bg-red-500" />
                </div>
              )}
              <MessageBox key={chat.id} className={msgBoxClassName}>
                {!isMyMessage && (
                  <CircularImage
                    src={chat.image}
                    alt={chat.nickname}
                    className="mr-2 h-10 w-10"
                  />
                )}
                <div>
                  <span>{nickname}</span>
                  <Message className={msgClassName}>{chat.message}</Message>
                </div>
              </MessageBox>
            </>
          );
        })}
      </ChatContainer>
      <MessageForm onSubmit={onSendMessage}>
        <input type="text" onChange={onTextChange} value={message} />
        <button>Send</button>
      </MessageForm>
      {showAlert && (
        <AlertWithCloseButton
          message="You can't send DM to user who blocked you."
          onClose={handleCloseAlert}
        />
      )}
    </>
  );
};

export default ChatRoom;
