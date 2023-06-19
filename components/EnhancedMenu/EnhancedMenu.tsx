import React, {
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { PluginID } from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import ChangeOutputLanguageButton from './ChangeOutputLanguageButton';
import ConversationStyleSelector from './ConversationStyleSelector';
import ImageGenerationSelectors from './ImageGenerationSelectors';
import SpeechRecognitionLanguageSelector from './SpeechRecognitionLanguageSelector';
import ModeSelector from './ModeSelector';
import VoiceInputActiveOverlay from '@/components/VoiceInput/VoiceInputActiveOverlay';

import PropTypes from 'prop-types';

type EnhancedMenuProps = {
  isFocused: boolean;
  setIsFocused: (isFocused: boolean) => void;
};

const EnhancedMenu = forwardRef<HTMLDivElement, EnhancedMenuProps>(
  ({ isFocused, setIsFocused }, ref) => {
    const {
      state: {
        messageIsStreaming,
        currentMessage,
        isSpeechRecognitionActive,
      },
    } = useContext(HomeContext);

    const shouldShow = useMemo(() => {
      return isFocused && !messageIsStreaming;
    }, [isFocused, messageIsStreaming]);

    // THIS IS A DELAY FOR THE MENU ANIMATION
    const [showMenuDisplay, setShowMenuDisplay] = useState(false);
    const [showMenuAnimation, setShowMenuAnimation] = useState(false);

    useEffect(() => {
      if (shouldShow) {
        setShowMenuDisplay(true);
        setTimeout(() => {
          setShowMenuAnimation(true);
        }, 1);
      } else {
        setShowMenuAnimation(false);
        setTimeout(() => {
          setShowMenuDisplay(false);
        }, 1);
      }
    }, [shouldShow]);

    return (
      <div
        ref={ref}
        className={`absolute w-full h-fit left-0 overflow-hidden
          bg-white dark:bg-[#343541] text-black dark:text-white 
          z-10 rounded-md -translate-y-[100%]
          border dark:border-gray-900/50 shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)]
          transition-all ease-in-out ${
            showMenuAnimation ? '-top-2 opacity-90' : 'top-8 opacity-0'
          } ${
            isSpeechRecognitionActive ? 'z-[1100]' : ''
          }`}
        style={{
          display: showMenuDisplay ? 'flex' : 'none',
        }}
      >
        <div className="relative w-full px-4 py-2 flex flex-col">
          <div className="flex flex-row w-full justify-start items-center pb-2 mb-2 border-b dark:border-gray-900/50">
            <SpeechRecognitionLanguageSelector />
          </div>
          <div className="flex flex-col md:flex-row w-full justify-between">
            <ModeSelector />
            <ConversationStyleSelector />
            {currentMessage?.pluginId !== PluginID.IMAGE_GEN && (
              <>
                <ChangeOutputLanguageButton />
              </>
            )}
          </div>
          {currentMessage?.pluginId === PluginID.IMAGE_GEN && (
            <ImageGenerationSelectors />
          )}
          <VoiceInputActiveOverlay />
        </div>
      </div>
    );
  },
);

EnhancedMenu.propTypes = {
  isFocused: PropTypes.bool.isRequired,
  setIsFocused: PropTypes.func.isRequired,
};

EnhancedMenu.displayName = 'EnhancedMenu';

export default EnhancedMenu;
