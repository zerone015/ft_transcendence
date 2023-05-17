import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCallAPI from '../../api';
import { User } from '../../pages/UserProfile';
import HoverButton from '../button/HoverButton';
import CircularImage from '../container/CircularImage';
// import { users as data } from '../../mock';

const Header: React.FC = () => {
  const callAPI = useCallAPI();
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const handleClickHome = () => navigate('/');
  const handleClickMyPage = () => navigate('/my-page');
  const handleClickUser = (id: number) => navigate(`/profile/${id}`);
  const handleChangeSearch = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nickname = event.target.value;
    setSearch(nickname);
    const params = {
      nickname,
    };
    const data: User[] = await callAPI('/api/v1/users/search', params);
    setSearchResults(data);
  };

  return (
    <div className="m-4 flex items-center justify-between">
      <HoverButton onClick={handleClickHome} className="rounded border-2 p-2.5">
        Home
      </HoverButton>
      <div className="relative w-[40%]">
        <input
          type="text"
          placeholder="Search users"
          value={search}
          onChange={handleChangeSearch}
          className="w-full rounded border border-white p-2 shadow"
        />
        {search && (
          <ul className="absolute z-10 flex w-full flex-col rounded border-2 bg-black bg-white px-2.5 pb-2 pt-1.5 shadow-md">
            {searchResults.map((user) => {
              const { id, nickname, image } = user;
              return (
                <button
                  key={nickname}
                  className="flex border-b border-gray-300 py-1"
                  onClick={() => handleClickUser(id)}
                >
                  <CircularImage
                    src={image}
                    alt={nickname}
                    className="mr-2 h-6 w-6 align-bottom"
                  />
                  {nickname}
                </button>
              );
            })}
          </ul>
        )}
      </div>
      <HoverButton
        onClick={handleClickMyPage}
        className="rounded border-2 p-2.5"
      >
        My Page
      </HoverButton>
    </div>
  );
};

export default Header;
