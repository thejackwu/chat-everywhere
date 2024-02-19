import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { event } from 'nextjs-google-analytics';

import { useCreateReducer } from '@/hooks/useCreateReducer';
import useMediaQuery from '@/hooks/useMediaQuery';
import useUserProfile from '@/hooks/useUserProfile';

import { fetchShareableConversation } from '@/utils/app/api';
import {
  cleanConversationHistory,
  cleanFolders,
  cleanPrompts,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
  getNonDeletedCollection,
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { updateConversationLastUpdatedAtTimeStamp } from '@/utils/app/conversation';
import {
  clearUserInfo,
  logUsageSnapshot,
  trackEvent,
  updateUserInfo,
} from '@/utils/app/eventTracking';
import { saveFolders } from '@/utils/app/folders';
import { convertMarkdownToText } from '@/utils/app/outputLanguage';
import { savePrompts } from '@/utils/app/prompts';
import { generateRank, sortByRank } from '@/utils/app/rank';
import { syncData } from '@/utils/app/sync';
import { getIsSurveyFilledFromLocalStorage } from '@/utils/app/ui';
import { deepEqual } from '@/utils/app/ui';
import { userProfileQuery } from '@/utils/server/supabase';

import { Conversation } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { DragData } from '@/types/drag';
import { LatestExportFormat } from '@/types/export';
import { FolderInterface, FolderType } from '@/types/folder';
import { OpenAIModels, fallbackModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { useAzureTts } from '@/components/Hooks/useAzureTts';
import { useFetchCreditUsage } from '@/components/Hooks/useFetchCreditUsage';
import OrientationBlock from '@/components/Mobile/OrientationBlock';

import HomeContext from '../home/home.context';
import { HomeInitialState, initialState } from '../home/home.state';

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

const DefaultLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const defaultModelId = fallbackModelID;
  const { t } = useTranslation('chat');
  const { isLoading, isPlaying, currentSpeechId, speak, stopPlaying } =
    useAzureTts();
  const router = useRouter();
  const session = useSession();
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
      speechRecognitionLanguage,
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

    const updatedFolders = [...folders, newFolder];

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

  const handleNewConversation = () => {
    //  CLOSE CHATBAR ON MOBILE LAYOUT WHEN SELECTING CONVERSATION
    if (isTabletLayout) {
      dispatch({ field: 'showChatbar', value: false });
    }

    const newConversation: Conversation = getNewConversation();

    const updatedConversations = [newConversation, ...conversations];

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

  const getNewConversation = () => {
    const lastConversation = conversations[conversations.length - 1];

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
      rank: generateRank(getNonDeletedCollection(conversations), 0),
      folderId: null,
      lastUpdateAtUTC: dayjs().valueOf(),
    };
    return newConversation;
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
  }, [defaultModelId]);

  // CLOUD SYNC ------------------------------------------

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

        const syncResult: LatestExportFormat | null = await syncData(
          supabase,
          user,
          replaceRemoteData,
        );

        if (syncResult !== null) {
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

  const { refetch: fetchUserProfile } = useUserProfile({
    userId: session?.user.id,
  });
  // USER AUTH ------------------------------------------
  useEffect(() => {
    if (session?.user) {
      // User info has been updated for this session
      if (session.user.id === user?.id) return;
      fetchUserProfile()
        .then((result) => {
          const userProfile = result.data;
          if (!userProfile) return;
          dispatch({ field: 'showLoginSignUpModel', value: false });
          dispatch({ field: 'showOneTimeCodeLoginModel', value: false });
          dispatch({ field: 'isPaidUser', value: userProfile.plan !== 'free' });
          dispatch({ field: 'isTempUser', value: userProfile.isTempUser });
          dispatch({
            field: 'isTeacherAccount',
            value: userProfile.isTeacherAccount,
          });
          dispatch({
            field: 'isUltraUser',
            value: userProfile.plan === 'ultra',
          });
          dispatch({
            field: 'hasMqttConnection',
            value: userProfile.hasMqttConnection,
          });
          dispatch({
            field: 'isConnectedWithLine',
            value: userProfile.isConnectedWithLine,
          });
          dispatch({
            field: 'user',
            value: {
              id: session.user.id,
              email: session.user.email,
              plan: userProfile.plan || 'free',
              token: session.access_token,
              referralCode: userProfile.referralCode,
              referralCodeExpirationDate:
                userProfile.referralCodeExpirationDate,
              proPlanExpirationDate: userProfile.proPlanExpirationDate,
              hasReferrer: userProfile.hasReferrer,
              hasReferee: userProfile.hasReferee,
              isInReferralTrial: userProfile.isInReferralTrial,
            },
          });
        })
        .catch((error) => {
          console.log(error);
          toast.error(
            t('Unable to load your information, please try again later.'),
          );
        });

      //Check if survey is filled by logged in user
      supabase
        .from('user_survey')
        .select('name')
        .eq('uid', session.user.id)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            dispatch({ field: 'isSurveyFilled', value: false });
          } else {
            dispatch({ field: 'isSurveyFilled', value: true });
          }
        });
    } else {
      dispatch({
        field: 'isSurveyFilled',
        value: getIsSurveyFilledFromLocalStorage(),
      });
    }
  }, [session]);

  useEffect(() => {
    if (!user) return;
    updateUserInfo(user);
    fetchAndUpdateCreditUsage(user.id, isPaidUser);
  }, [user, isPaidUser, conversations]);

  const handleUserLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ field: 'user', value: null });
    dispatch({ field: 'showSettingsModel', value: false });
    toast.success(t('You have been logged out'));
    clearUserInfo();
  };

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
      const parsedFolders: FolderInterface[] =
        JSON.parse(folders).sort(sortByRank);
      cleanedFolders = cleanFolders(parsedFolders);
      dispatch({ field: 'folders', value: cleanedFolders });
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      const parsedPrompts: Prompt[] = JSON.parse(prompts).sort(sortByRank);
      cleanedPrompts = cleanPrompts(parsedPrompts);
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
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory).sort(sortByRank);
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

    const newConversation = {
      id: uuidv4(),
      name: 'New conversation',
      messages: [],
      model: OpenAIModels[defaultModelId],
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      folderId: null,
    };

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
        .catch((error) => {
          toast.error(t('Sorry, we could not find this shared conversation.'));
          dispatch({
            field: 'selectedConversation',
            value: newConversation,
          });
        })
        .finally(() => {
          dispatch({ field: 'loading', value: false });
          trackEvent('Share conversation loaded');
        });
    } else {
      dispatch({
        field: 'selectedConversation',
        value: newConversation,
      });
    }
  }, []);

  // APPLY HOOKS VALUE TO CONTEXT -------------------------------------
  useEffect(() => {
    dispatch({ field: 'isPlaying', value: isPlaying });
  }, [isPlaying]);

  useEffect(() => {
    dispatch({ field: 'isLoading', value: isLoading });
  }, [isLoading]);

  useEffect(() => {
    dispatch({ field: 'currentSpeechId', value: currentSpeechId });
  }, [currentSpeechId]);

  useEffect(() => {
    dispatch({ field: 'creditUsage', value: creditUsage });
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
          handleUserLogout,
          playMessage: (text, speechId) =>
            speak(
              convertMarkdownToText(text),
              speechId,
              user?.token || '',
              speechRecognitionLanguage,
            ),
          stopPlaying,
          toggleChatbar,
          togglePromptbar,
          setDragData,
          removeDragData,
          stopConversationRef,
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
        <>{children}</>
      </HomeContext.Provider>
    </OrientationBlock>
  );
};
export default DefaultLayout;