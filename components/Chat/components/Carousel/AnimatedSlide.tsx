import React, { memo, useEffect, useRef, useState } from 'react';

type AnimatedSlideProps = {
  direction: 'left' | 'right' | null;
  children: React.ReactNode;
};

const AnimatedSlide: React.FC<AnimatedSlideProps> = ({
  direction,
  children,
}) => {
  const [animationClass, setAnimationClass] = useState('');
  const [mounted, setMounted] = useState(false);
  const previousChildrenRef = useRef(children);

  useEffect(() => {
    if (mounted) {
      if (direction === 'left') {
        setAnimationClass('slide-out-right');
        setTimeout(() => {
          previousChildrenRef.current = children;
          setAnimationClass('slide-in-left');
        }, 500);
      } else if (direction === 'right') {
        setAnimationClass('slide-out-left');
        setTimeout(() => {
          previousChildrenRef.current = children;
          setAnimationClass('slide-in-right');
        }, 500);
      }
    } else {
      setMounted(true);
    }
  }, [direction, children, mounted]);

  return (
    <div className={`${animationClass}`}>
      <style jsx>{`
        .slide-in-right {
          animation: slide-in-right 0.5s forwards;
        }

        .slide-out-left {
          animation: slide-out-left 0.5s forwards;
        }

        .slide-in-left {
          animation: slide-in-left 0.5s forwards;
        }

        .slide-out-right {
          animation: slide-out-right 0.5s forwards;
        }

        @keyframes slide-in-right {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-out-left {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(-100%);
            opacity: 0;
          }
        }

        @keyframes slide-in-left {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-out-right {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      {previousChildrenRef.current}
    </div>
  );
};

export default memo(AnimatedSlide);