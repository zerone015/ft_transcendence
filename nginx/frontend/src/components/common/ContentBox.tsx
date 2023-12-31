import React from 'react';

interface ContentBoxProps {
  children: React.ReactNode;
  className?: string;
}

const ContentBox: React.FC<ContentBoxProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center border-white text-center text-white ${className}`}
    >
      {children}
    </div>
  );
};

export default ContentBox;
