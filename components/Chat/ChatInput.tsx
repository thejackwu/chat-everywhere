import { IconPlayerStop, IconRepeat, IconSend } from '@tabler/icons-react';
import type { KeyboardEvent, MutableRefObject } from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { useFileList } from '@/hooks/chatInput/useFileList';
import { usePromptList } from '@/hooks/chatInput/usePromptList';
import useDisplayAttribute from '@/hooks/useDisplayAttribute';
import useFocusHandler from '@/hooks/useFocusInputHandler';

import { getNonDeletedCollection } from '@/utils/app/conversation';
import { getPluginIcon } from '@/utils/app/ui';

import type { UserFile } from '@/types/UserFile';
import type { Message } from '@/types/chat';
import { PluginID } from '@/types/plugin';
import type { Prompt } from '@/types/prompt';

import TokenCounter from './components/TokenCounter';
import HomeContext from '@/components/home/home.context';

import { useCognitiveService } from '../CognitiveService/CognitiveServiceProvider';
import EnhancedMenu from '../EnhancedMenu/EnhancedMenu';
import VoiceInputButton from '../Voice/VoiceInputButton';
import { FileList } from './FileList';
import { PromptList } from './PromptList';
import UserFileItem from './UserFileItem';
import { VariableModal } from './VariableModal';

import { cn } from '@/lib/utils';

interface Props {
  onSend: (currentMessage: Message) => void;
  onRegenerate: () => void;
  stopConversationRef: MutableRefObject<boolean>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
}

export const ChatInput = ({
  onSend,
  onRegenerate,
  stopConversationRef,
  textareaRef,
}: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      selectedConversation,
      messageIsStreaming,
      prompts: originalPrompts,
      currentMessage,
      showSettingsModel,
    },
    dispatch: homeDispatch,
  } = useContext(HomeContext);
  const {
    showPromptList,
    setShowPromptList,
    activePromptIndex,
    setActivePromptIndex,
    filteredPrompts,
    updatePromptListVisibility,
  } = usePromptList({ originalPrompts });
  const {
    showFileList,
    setShowFileList,
    activeFileIndex,
    setActiveFileIndex,
    filteredFiles,
    updateFileListVisibility,
  } = useFileList();

  const {
    isConversing,
    setSendMessage,
    speechContent,
    isSpeechRecognitionActive,
  } = useCognitiveService();

  const [content, setContent] = useState<string>();
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const [variables, setVariables] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const promptListRef = useRef<HTMLUListElement | null>(null);
  const fileListRef = useRef<HTMLUListElement | null>(null);

  const { isFocused, setIsFocused, menuRef } = useFocusHandler(textareaRef);
  const [isOverTokenLimit, setIsOverTokenLimit] = useState(false);
  const [isCloseToTokenLimit, setIsCloseToTokenLimit] = useState(false);

  const prompts = useMemo(() => {
    return getNonDeletedCollection(originalPrompts);
  }, [originalPrompts]);

  const enhancedMenuDisplayValue = useDisplayAttribute(menuRef);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isSpeechRecognitionActive) {
      e.preventDefault();
      return;
    }
    const value = e.target.value;

    setContent(value);
    updatePromptListVisibility(value);
    updateFileListVisibility(value);
  };

  const handleSend = useCallback(
    (ignoreEmpty: boolean = false) => {
      if (messageIsStreaming) {
        return;
      }

      const content = textareaRef.current?.value;
      if (!content) {
        if (!ignoreEmpty) alert(t('Please enter a message'));
        return;
      }

      if (isOverTokenLimit) {
        return;
      }

      if (currentMessage) {
        onSend({
          ...currentMessage,
          content,
          role: 'user',
        });
        setContent('');
        homeDispatch({
          field: 'currentMessage',
          value: {
            ...currentMessage,
            content: '',
            fileList: [],
          },
        });
        if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
          textareaRef.current.blur();
        }
      } else {
        alert('currentMessage is null');
      }
    },
    [
      homeDispatch,
      messageIsStreaming,
      textareaRef,
      isOverTokenLimit,
      currentMessage,
      onSend,
      t,
    ],
  );

  const handleStopConversation = () => {
    stopConversationRef.current = true;
    setTimeout(() => {
      stopConversationRef.current = false;
    }, 1000);
  };

  const isMobile = () => {
    const userAgent =
      typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
    return mobileRegex.test(userAgent);
  };

  const handleInitModal = () => {
    const selectedPrompt = filteredPrompts[activePromptIndex];
    if (selectedPrompt) {
      setContent((prevContent) => {
        const newContent = prevContent?.replace(
          /\/\w*$/,
          selectedPrompt.content,
        );
        return newContent;
      });
      handlePromptSelect(selectedPrompt);
    }
    setShowPromptList(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    setIsTyping(e.nativeEvent.isComposing);
    if (showPromptList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : prevIndex,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : prevIndex,
        );
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : 0,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleInitModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPromptList(false);
      } else {
        setActivePromptIndex(0);
      }
    } else if (showFileList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveFileIndex((prevIndex) =>
          prevIndex < filteredFiles.length - 1 ? prevIndex + 1 : prevIndex,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveFileIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : prevIndex,
        );
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActiveFileIndex((prevIndex) =>
          prevIndex < filteredFiles.length - 1 ? prevIndex + 1 : 0,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleFileSelect(filteredFiles[activeFileIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowFileList(false);
      } else {
        setActiveFileIndex(0);
      }
    } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === '/' && e.metaKey) {
      e.preventDefault();
    }
  };

  const parseVariables = (content: string) => {
    const regex = /{{(.*?)}}/g;
    const foundVariables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      foundVariables.push(match[1]);
    }

    return foundVariables;
  };

  const handleFileSelect = (file: UserFile) => {
    const existingFiles = currentMessage?.fileList || [];
    const isFileAlreadyIncluded = existingFiles.some(
      (existingFile) => existingFile.id === file.id,
    );

    if (!isFileAlreadyIncluded) {
      homeDispatch({
        field: 'currentMessage',
        value: {
          ...currentMessage,
          fileList: [...existingFiles, file],
          pluginId: PluginID.GEMINI,
        },
      });
    }
    setContent((prevContent) => {
      const newContent = prevContent?.replace(/\@\w*$/, '');
      return newContent;
    });
    setShowFileList(false);
  };
  const handlePromptSelect = (prompt: Prompt) => {
    const parsedVariables = parseVariables(prompt.content);
    setVariables(parsedVariables);

    if (parsedVariables.length > 0) {
      setIsModalVisible(true);
    } else {
      setContent((prevContent) => {
        const updatedContent = prevContent?.replace(/\/\w*$/, prompt.content);
        return updatedContent;
      });
      updatePromptListVisibility(prompt.content);
    }
  };

  const handleSubmit = (updatedVariables: string[]) => {
    const newContent = content?.replace(/{{(.*?)}}/g, (_match, variable) => {
      const index = variables.indexOf(variable);
      return updatedVariables[index];
    });

    setContent(newContent);

    if (textareaRef && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  useEffect(() => {
    if (promptListRef.current) {
      promptListRef.current.scrollTop = activePromptIndex * 30;
    }
  }, [activePromptIndex]);

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
      textareaRef.current.style.overflow = `${textareaRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && !isFocused && !showSettingsModel) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, showSettingsModel]);

  useEffect(() => {
    // Create currentMessage
    homeDispatch({
      field: 'currentMessage',
      value: {
        ...currentMessage,
        pluginId: null,
      },
    });
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        promptListRef.current &&
        !promptListRef.current.contains(e.target as Node)
      ) {
        setShowPromptList(false);
      }
    };

    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setContent(speechContent);
  }, [speechContent]);

  // Needed for conversation mode
  useEffect(() => {
    setSendMessage(handleSend);
  }, [setSendMessage, handleSend]);

  const isAiImagePluginSelected = useMemo(
    () => currentMessage?.pluginId === PluginID.IMAGE_GEN,
    [currentMessage?.pluginId],
  );

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-white to-white pt-6 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] md:pt-2',
        isConversing && 'z-[1200]',
      )}
    >
      <div
        className={` ${enhancedMenuDisplayValue === 'none' ? 'mt-6 md:mt-12' : `${isAiImagePluginSelected ? 'mt-[16.9rem] md:mt-[12.8rem]' : 'mt-56 md:mt-40'}`} mx-2 my-4 flex flex-row gap-3 transition-all ease-in-out md:mx-4 md:last:mb-6 lg:mx-auto lg:max-w-3xl`}
      >
        {/* Disable stop generating button for image generation until implemented */}
        {messageIsStreaming &&
          !isConversing &&
          currentMessage?.pluginId !== PluginID.IMAGE_GEN && (
            <button
              className="absolute inset-x-0 top-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white px-4 py-2 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
              onClick={handleStopConversation}
            >
              <IconPlayerStop size={16} /> {t('Stop Generating')}
            </button>
          )}

        {!messageIsStreaming &&
          !isConversing &&
          selectedConversation &&
          selectedConversation.messages.length > 0 && (
            <button
              className="absolute inset-x-0 top-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white px-4 py-2 text-black hover:opacity-50 disabled:opacity-25 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
              onClick={() => onRegenerate()}
            >
              <IconRepeat size={16} /> {t('Regenerate response')}
            </button>
          )}

        <div
          className={`relative mx-2 flex w-full grow flex-col rounded-md
            border bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)]
            dark:bg-[#40414F] dark:text-white
            dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4
            ${isOverTokenLimit && !isSpeechRecognitionActive ? '!border-red-500 dark:!border-red-600' : ''} ${!currentMessage || currentMessage.pluginId === null ? 'border-black/10 dark:border-gray-900/50' : currentMessage.pluginId === PluginID.GEMINI ? 'border-yellow-500 dark:border-yellow-400' : 'border-blue-800 dark:border-blue-700'}
          `}
        >
          <EnhancedMenu ref={menuRef} isFocused={isFocused} />

          <div className="flex items-start">
            <div className="flex items-center pl-1 pt-1">
              <VoiceInputButton onClick={() => setIsFocused(false)} />
              <button className="cursor-default rounded-sm p-1 text-zinc-500 dark:text-zinc-400">
                {getPluginIcon(currentMessage?.pluginId)}
              </button>
            </div>

            <div className="flex w-full flex-col">
              <textarea
                data-cy="chat-input"
                onFocus={() => setIsFocused(true)}
                ref={textareaRef}
                className={` m-0 w-full resize-none rounded-md bg-white pl-2 pr-8 pt-3 text-black outline-none dark:bg-[#40414F] dark:text-white ${isSpeechRecognitionActive || isConversing ? 'pointer-events-none' : ''} ${isOverTokenLimit && isSpeechRecognitionActive ? 'border !border-red-500 dark:!border-red-600' : 'border-0'} `}
                style={{
                  paddingBottom: `${isCloseToTokenLimit || isOverTokenLimit ? '2.2' : '0.75'}rem `,
                  resize: 'none',
                  bottom: `${textareaRef?.current?.scrollHeight}px`,
                  maxHeight: '400px',
                  overflow: `${textareaRef.current && textareaRef.current.scrollHeight > 400 ? 'auto' : 'hidden'}`,
                }}
                placeholder={t('Type a message ...') || ''}
                value={content}
                rows={1}
                onKeyUp={(e) => setIsTyping(e.nativeEvent.isComposing)}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
              />

              {currentMessage &&
                currentMessage.fileList &&
                currentMessage.fileList.length > 0 && (
                  <div className="flex flex-row flex-wrap gap-2 p-2">
                    {currentMessage.fileList.map((file, index) => {
                      return (
                        <UserFileItem
                          key={`chat-input-file-${file.id}-${index}`}
                          file={file}
                          onRemove={() => {
                            if (!currentMessage || !currentMessage.fileList)
                              return;
                            homeDispatch({
                              field: 'currentMessage',
                              value: {
                                ...currentMessage,
                                fileList: currentMessage.fileList.filter(
                                  (f) => f.id !== file.id,
                                ),
                              },
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                )}
            </div>
          </div>

          <TokenCounter
            className={`
              ${isOverTokenLimit ? '!text-red-500 dark:text-red-600' : ''} ${isCloseToTokenLimit || isOverTokenLimit ? 'visible' : 'invisible'} ${isSpeechRecognitionActive ? 'pointer-events-none' : ''}
              absolute bottom-2 right-2 text-sm text-neutral-500 dark:text-neutral-400
            `}
            value={content}
            setIsOverLimit={setIsOverTokenLimit}
            setIsCloseToLimit={setIsCloseToTokenLimit}
          />

          {!isConversing && (
            <button
              className="absolute right-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
              onClick={() => handleSend()}
              data-cy="chat-send-button"
            >
              {messageIsStreaming ? (
                <div className="size-4 animate-spin rounded-full border-t-2 text-zinc-500 dark:text-zinc-400"></div>
              ) : (
                <IconSend size={18} />
              )}
            </button>
          )}

          {showPromptList && filteredPrompts.length > 0 && (
            <div className="absolute bottom-12 z-20 w-full">
              <PromptList
                activePromptIndex={activePromptIndex}
                prompts={filteredPrompts}
                onSelect={handleInitModal}
                onMouseOver={setActivePromptIndex}
                promptListRef={promptListRef}
              />
            </div>
          )}
          {showFileList && filteredFiles.length > 0 && (
            <div className="absolute bottom-12 z-20 w-full">
              <FileList
                fileListRef={fileListRef}
                activeFileIndex={activeFileIndex}
                files={filteredFiles}
                onSelect={handleFileSelect}
                onMouseOver={setActiveFileIndex}
              />
            </div>
          )}

          {isModalVisible && (
            <VariableModal
              prompt={prompts[activePromptIndex]}
              variables={variables}
              onSubmit={handleSubmit}
              onClose={() => setIsModalVisible(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
