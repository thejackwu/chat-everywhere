import { IconCaretLeft, IconCaretRight } from '@tabler/icons-react';
import React, {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';

import AnimatedSlide from './AnimatedSlide';
import CarouselThumbnails from './CarouselThumbnails';

type CarouselProps = {
  children: ReactNode[];
};

const Carousel: React.FC<CarouselProps> = ({ children }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    state: { selectedConversation },
  } = useContext(HomeContext);
  // reset index on conversation change
  const selectedConversationId = useMemo(
    () => selectedConversation?.id,
    [selectedConversation],
  );
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedConversationId]);

  // always goes to the last child when the children change
  useEffect(() => {
    if (children.length > 0) {
      setCurrentIndex(children.length - 1);
    }
  }, [children]);

  const currentIndexChildren = useMemo(() => {
    return children[currentIndex];
  }, [children, currentIndex]);

  const nextSlide = () => {
    setDirection('right');
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex >= children.length ? 0 : newIndex);
  };

  const prevSlide = () => {
    setDirection('left');
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex < 0 ? children.length - 1 : newIndex);
  };

  const handleThumbnailClick = (index: number) => (event: React.MouseEvent) => {
    setDirection(index > currentIndex ? 'right' : 'left');
    event.stopPropagation();
    setCurrentIndex(index);
  };
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
    }
  }, [mounted]);
  return (
    <div className="flex flex-col items-center w-full max-w-[80dvw] mobile:max-w-[70dvw] gap-2">
      {mounted && (
        <>
          {/* Current displaying */}
          <div className="relative flex justify-between w-full">
            <AnimatedSlide direction={direction}>
              {currentIndexChildren}
            </AnimatedSlide>

            {/* Main Display */}
            {children.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-[-4rem] mobile:left-[-3rem] top-[50%] translate-y-[-50%] p-4 cursor-pointer text-white"
                >
                  <IconCaretLeft height={`20dvw`} />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-[-4rem] mobile:right-[-3rem] top-[50%] translate-y-[-50%] p-4 cursor-pointer text-white"
                >
                  <IconCaretRight height={`20dvw`} />
                </button>
              </>
            )}
          </div>
          {/* Dots */}
          {children.length > 1 && (
            <div className="flex justify-center space-x-2 my-2">
              {children.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 w-2 rounded-full ${
                    currentIndex === index
                      ? 'bg-gray-800 dark:bg-white'
                      : 'bg-gray-300 dark:bg-gray-500'
                  }`}
                />
              ))}
            </div>
          )}
          {/* Thumbnails */}
          {children.length > 1 && (
            <CarouselThumbnails
              currentIndex={currentIndex}
              handleThumbnailClick={handleThumbnailClick}
            >
              {children}
            </CarouselThumbnails>
          )}
        </>
      )}
    </div>
  );
};

export default Carousel;