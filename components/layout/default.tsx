import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { LoadingBarRef } from 'react-top-loading-bar';
import LoadingBar from 'react-top-loading-bar';

import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { event } from 'nextjs-google-analytics';

import { useCreateReducer } from '@/hooks/useCreateReducer';
import useLoginHook from '@/hooks/useLoginHook';
import useMediaQuery from '@/hooks/useMediaQuery';

import { fetchShareableConversation } from '@/utils/app/api';
import {
  cleanConversationHistory,
  cleanFolders,
  cleanPrompts,
} from '@/utils/app/clean';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  newDefaultConversation,
} from '@/utils/app/const';
import {
  getNonDeletedCollection,
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { updateConversationLastUpdatedAtTimeStamp } from '@/utils/app/conversation';
import { logUsageSnapshot, trackEvent } from '@/utils/app/eventTracking';
import { saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import {
  areFoldersBalanced,
  areItemsBalanced,
  generateRank,
  rebalanceFolders,
  rebalanceItems,
  sortByRankAndFolder,
  sortByRankAndFolderType,
} from '@/utils/app/rank';
import { syncData } from '@/utils/app/sync';
import { deepEqual } from '@/utils/app/ui';

import type { Conversation } from '@/types/chat';
import type { KeyValuePair } from '@/types/data';
import type { DragData } from '@/types/drag';
import type { LatestExportFormat } from '@/types/export';
import type { FolderInterface, FolderType } from '@/types/folder';
import { OpenAIModels, fallbackModelID } from '@/types/openai';
import type { Prompt } from '@/types/prompt';

import { useFetchCreditUsage } from '@/components/Hooks/useFetchCreditUsage';
import OrientationBlock from '@/components/Mobile/OrientationBlock';

import { CognitiveServiceProvider } from '../CognitiveService/CognitiveServiceProvider';
import { DragDropContext } from '../DropArea/DragDropContext';
import HomeContext from '../home/home.context';
import type { HomeInitialState } from '../home/home.state';
import { initialState } from '../home/home.state';

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

const DefaultLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const loadingRef = useRef<LoadingBarRef>(null);
  const startLoadingBar = useCallback(() => {
    loadingRef.current?.continuousStart();
  }, []);
  const completeLoadingBar = useCallback(() => {
    loadingRef.current?.complete();
  }, []);
  const defaultModelId = fallbackModelID;
  const { t } = useTranslation('chat');
  const router = useRouter();
  const supabase = useSupabaseClient();

  const contextValue = useCreateReducer<HomeInitialState>({ initialState });

  const { fetchAndUpdateCreditUsage, creditUsage } = useFetchCreditUsage();

  const {
    state: {
      lightMode,
      folders,
      conversations,
      selectedConversation,
      prompts,
      showChatbar,
      showPromptbar,
      user,
      isPaidUser,
      conversationLastSyncAt,
      forceSyncConversation,
      replaceRemoteData,
      messageIsStreaming,
    },
    dispatch,
  } = contextValue;

  const stopConversationRef = useRef<boolean>(false);

  // FETCH MODELS ----------------------------------------------

  const isTabletLayout = useMediaQuery('(max-width: 768px)');
  const handleSelectConversation = (conversation: Conversation) => {
    //  CLOSE CHATBAR ON MOBILE LAYOUT WHEN SELECTING CONVERSATION
    if (isTabletLayout) {
      dispatch({ field: 'showChatbar', value: false });
    }

    dispatch({
      field: 'selectedConversation',
      value: conversation,
    });

    saveConversation(conversation);
  };

  // SWITCH LAYOUT SHOULD CLOSE ALL SIDEBAR --------------------

  useEffect(() => {
    if (isTabletLayout) {
      dispatch({ field: 'showChatbar', value: false });
      dispatch({ field: 'showPromptbar', value: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabletLayout]);

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = (name: string, type: FolderType) => {
    const newFolder: FolderInterface = {
      id: uuidv4(),
      name,
      type,
      lastUpdateAtUTC: dayjs().valueOf(),
      rank: generateRank(
        getNonDeletedCollection(folders).filter(
          (folder) => folder.type === type,
        ),
      ),
    };

    let updatedFolders = [...folders, newFolder];
    if (!areFoldersBalanced(updatedFolders)) {
      updatedFolders = rebalanceFolders(updatedFolders);
    }

    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
    updateConversationLastUpdatedAtTimeStamp();
  };

  const handleDeleteFolder = (folderId: string) => {
    const updatedFolders = folders.map((folder) => {
      if (folder.id === folderId) {
        return {
          ...folder,
          deleted: true,
        };
      }

      return folder;
    });
    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);

    const updatedConversations: Conversation[] = conversations.map((c) => {
      if (c.folderId === folderId) {
        return {
          ...c,
          folderId: null,
        };
      }

      return c;
    });

    dispatch({ field: 'conversations', value: updatedConversations });
    saveConversations(updatedConversations);

    const updatedPrompts: Prompt[] = prompts.map((p) => {
      if (p.folderId === folderId) {
        return {
          ...p,
          folderId: null,
        };
      }

      return p;
    });

    dispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
    updateConversationLastUpdatedAtTimeStamp();
  };

  const handleUpdateFolder = (folderId: string, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
          lastUpdateAtUTC: dayjs().valueOf(),
        };
      }

      return f;
    });

    dispatch({ field: 'folders', value: updatedFolders });

    saveFolders(updatedFolders);

    updateConversationLastUpdatedAtTimeStamp();
  };

  // CONVERSATION OPERATIONS  --------------------------------------------

  const handleNewConversation = (folderId?: string) => {
    //  CLOSE CHATBAR ON MOBILE LAYOUT WHEN SELECTING CONVERSATION
    if (isTabletLayout) {
      dispatch({ field: 'showChatbar', value: false });
    }

    const newConversation: Conversation = getNewConversation(folderId);

    let updatedConversations = [newConversation, ...conversations];
    if (!areItemsBalanced(updatedConversations)) {
      updatedConversations = rebalanceItems(updatedConversations);
    }

    dispatch({ field: 'selectedConversation', value: newConversation });
    dispatch({ field: 'conversations', value: updatedConversations });

    saveConversation(newConversation);
    saveConversations(updatedConversations);

    dispatch({ field: 'loading', value: false });
  };

  const handleUpdateConversation = (
    conversation: Conversation,
    data: KeyValuePair,
  ) => {
    const updatedConversation = {
      ...conversation,
      [data.key]: data.value,
    };

    const { single, all } = updateConversation(
      updatedConversation,
      conversations,
    );

    dispatch({ field: 'selectedConversation', value: single });
    dispatch({ field: 'conversations', value: all });
    updateConversationLastUpdatedAtTimeStamp();
    event('interaction', {
      category: 'Conversation',
      label: 'Create New Conversation',
    });
  };

  const getNewConversation = (folderId: string | null = null) => {
    const lastConversation = conversations[conversations.length - 1];

    let filteredConversations: Conversation[] = getNonDeletedCollection(
      conversations,
    ).filter((c) => c.folderId === folderId);

    const newConversation: Conversation = {
      id: uuidv4(),
      name: `${t('New Conversation')}`,
      messages: [],
      model: lastConversation?.model || {
        id: OpenAIModels[defaultModelId].id,
        name: OpenAIModels[defaultModelId].name,
        maxLength: OpenAIModels[defaultModelId].maxLength,
        tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
      },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      rank: generateRank(filteredConversations, 0),
      folderId,
      lastUpdateAtUTC: dayjs().valueOf(),
    };
    return newConversation;
  };

  // PROMPTS ---------------------------------------------
  const handleCreatePrompt = (folderId: string | null = null) => {
    const filteredPrompts: Prompt[] = getNonDeletedCollection(prompts).filter(
      (p) => p.folderId === folderId,
    );

    if (defaultModelId) {
      const newPrompt: Prompt = {
        id: uuidv4(),
        name: `Prompt ${filteredPrompts.length + 1}`,
        description: '',
        content: '',
        model: OpenAIModels[defaultModelId],
        folderId: folderId,
        lastUpdateAtUTC: dayjs().valueOf(),
        rank: generateRank(filteredPrompts),
      };

      let updatedPrompts = [...prompts, newPrompt];
      if (!areItemsBalanced(updatedPrompts)) {
        updatedPrompts = rebalanceItems(updatedPrompts);
      }

      dispatch({ field: 'prompts', value: updatedPrompts });

      savePrompts(updatedPrompts);

      updateConversationLastUpdatedAtTimeStamp();
    }
  };

  // SIDEBAR ---------------------------------------------

  const toggleChatbar = (): void => {
    dispatch({ field: 'showChatbar', value: !showChatbar });
    localStorage.setItem('showChatbar', JSON.stringify(!showChatbar));
  };

  const togglePromptbar = () => {
    dispatch({ field: 'showPromptbar', value: !showPromptbar });
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  useEffect(() => {
    document.documentElement.style.overflow =
      showChatbar || showPromptbar ? 'hidden' : 'auto';
  }, [showChatbar, showPromptbar]);

  // DRAGGING ITEMS --------------------------------------

  const setDragData = (dragData: DragData): void => {
    dispatch({ field: 'currentDrag', value: dragData });
  };

  const removeDragData = (): void => {
    dispatch({ field: 'currentDrag', value: undefined });
  };
  // EFFECTS  --------------------------------------------

  useEffect(() => {
    defaultModelId &&
      dispatch({ field: 'defaultModelId', value: defaultModelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultModelId]);

  // CLOUD SYNC ------------------------------------------

  const currentSyncId = useRef(0);
  useEffect(() => {
    if (messageIsStreaming) return;
    if (!user) return;
    if (!isPaidUser) return;

    const conversationLastUpdatedAt = localStorage.getItem(
      'conversationLastUpdatedAt',
    );

    const syncConversationsAction = async () => {
      try {
        dispatch({ field: 'syncingConversation', value: true });

        const syncId = ++currentSyncId.current;
        const syncResult: LatestExportFormat | null = await syncData(
          supabase,
          user,
          replaceRemoteData,
        );

        if (syncResult !== null) {
          // To prevent race condition
          if (syncId !== currentSyncId.current) return;

          const { history, folders, prompts } = syncResult;
          dispatch({ field: 'conversations', value: history });
          dispatch({ field: 'folders', value: folders });
          dispatch({ field: 'prompts', value: prompts });
          saveConversations(history);
          saveFolders(folders);
          savePrompts(prompts);

          // skip if selected conversation is already in history
          const selectedConversationFromRemote = history.find(
            (remoteConversation) =>
              remoteConversation.id === selectedConversation?.id,
          );
          if (
            selectedConversation &&
            selectedConversationFromRemote &&
            !deepEqual(selectedConversation, selectedConversationFromRemote)
          ) {
            dispatch({
              field: 'selectedConversation',
              value: {
                ...selectedConversationFromRemote,
                imageStyle: selectedConversation.imageStyle,
                imageQuality: selectedConversation.imageQuality,
              },
            });
          }
        }
      } catch (e) {
        dispatch({ field: 'syncSuccess', value: false });
        console.log('error', e);
      }

      dispatch({ field: 'conversationLastSyncAt', value: dayjs().toString() });
      if (forceSyncConversation) {
        dispatch({ field: 'forceSyncConversation', value: false });
      }
      dispatch({ field: 'replaceRemoteData', value: false });
      dispatch({ field: 'syncSuccess', value: true });
      dispatch({ field: 'syncingConversation', value: false });
    };

    // Sync if we haven't sync for more than 5 seconds or it is the first time syncing upon loading
    if (
      !forceSyncConversation &&
      ((conversationLastSyncAt &&
        dayjs().diff(conversationLastSyncAt, 'seconds') < 5) ||
        !conversationLastUpdatedAt)
    )
      return;

    syncConversationsAction();
  }, [
    conversations,
    prompts,
    folders,
    user,
    supabase,
    dispatch,
    isPaidUser,
    forceSyncConversation,
    conversationLastSyncAt,
    messageIsStreaming,
    replaceRemoteData,
    selectedConversation,
  ]);

  // USER AUTH ------------------------------------------
  useLoginHook(user, dispatch);

  useEffect(() => {
    if (!user) return;
    fetchAndUpdateCreditUsage(user.id, isPaidUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPaidUser, conversations]);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme) {
      dispatch({ field: 'lightMode', value: theme as 'dark' | 'light' });
    }

    if (window.innerWidth < 640) {
      dispatch({ field: 'showChatbar', value: false });
      dispatch({ field: 'showPromptbar', value: false });
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      dispatch({ field: 'showChatbar', value: showChatbar === 'true' });
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      dispatch({ field: 'showPromptbar', value: showPromptbar === 'true' });
    }

    let cleanedFolders: FolderInterface[] = [];
    let cleanedPrompts: Prompt[] = [];
    let cleanedConversationHistory: Conversation[] = [];

    const folders = localStorage.getItem('folders');
    if (folders) {
      const parsedFolders: FolderInterface[] = sortByRankAndFolderType(
        JSON.parse(folders),
      );
      cleanedFolders = cleanFolders(parsedFolders);
      dispatch({ field: 'folders', value: cleanedFolders });
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      const parsedPrompts = sortByRankAndFolder(JSON.parse(prompts));
      cleanedPrompts = cleanPrompts(parsedPrompts, cleanedFolders);
      dispatch({ field: 'prompts', value: cleanedPrompts });
    }

    const outputLanguage = localStorage.getItem('outputLanguage');
    if (outputLanguage) {
      dispatch({ field: 'outputLanguage', value: outputLanguage });
    }

    const speechRecognitionLanguage = localStorage.getItem(
      'speechRecognitionLanguage',
    );
    if (speechRecognitionLanguage) {
      dispatch({
        field: 'speechRecognitionLanguage',
        value: speechRecognitionLanguage,
      });
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    cleanedConversationHistory = [];
    if (conversationHistory) {
      const parsedConversationHistory = sortByRankAndFolder(
        JSON.parse(conversationHistory),
      );
      cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );
      dispatch({ field: 'conversations', value: cleanedConversationHistory });
    }

    logUsageSnapshot(
      cleanedFolders,
      cleanedConversationHistory,
      cleanedPrompts,
    );

    // Load shareable conversations
    const { shareable_conversation_id: accessibleConversationId } =
      router.query;

    if (accessibleConversationId) {
      dispatch({ field: 'loading', value: true });
      fetchShareableConversation(accessibleConversationId as string)
        .then((conversation) => {
          if (conversation) {
            const updatedConversations = [
              ...cleanedConversationHistory,
              conversation,
            ];

            dispatch({ field: 'selectedConversation', value: conversation });
            dispatch({ field: 'conversations', value: updatedConversations });
            saveConversations(updatedConversations);

            toast.success(t('Conversation loaded successfully.'));
            router.replace(router.pathname, router.pathname, { shallow: true });
          }
        })
        .catch(() => {
          toast.error(t('Sorry, we could not find this shared conversation.'));
          dispatch({
            field: 'selectedConversation',
            value: newDefaultConversation,
          });
        })
        .finally(() => {
          dispatch({ field: 'loading', value: false });
          trackEvent('Share conversation loaded');
        });
    } else {
      dispatch({
        field: 'selectedConversation',
        value: newDefaultConversation,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // APPLY HOOKS VALUE TO CONTEXT -------------------------------------
  useEffect(() => {
    dispatch({ field: 'creditUsage', value: creditUsage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditUsage]);
  useEffect(() => {
    document.body.className = lightMode;
  }, [lightMode]);

  return (
    <OrientationBlock>
      <HomeContext.Provider
        value={{
          ...contextValue,
          handleNewConversation,
          handleCreateFolder,
          handleDeleteFolder,
          handleUpdateFolder,
          handleSelectConversation,
          handleUpdateConversation,
          handleCreatePrompt,
          toggleChatbar,
          togglePromptbar,
          setDragData,
          removeDragData,
          stopConversationRef,
          startLoadingBar,
          completeLoadingBar,
        }}
      >
        <Head>
          <title>Chat Everywhere</title>
          <meta name="description" content="Use ChatGPT anywhere" />
          <meta
            name="viewport"
            content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1"
          />
        </Head>
        <LoadingBar color={'white'} ref={loadingRef} />
        <CognitiveServiceProvider>
          <DragDropContext>{children}</DragDropContext>
        </CognitiveServiceProvider>
      </HomeContext.Provider>
    </OrientationBlock>
  );
};

export default DefaultLayout;
