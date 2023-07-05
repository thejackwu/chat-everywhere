import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { event } from 'nextjs-google-analytics';

import { useCreateReducer } from '@/hooks/useCreateReducer';
import useMediaQuery from '@/hooks/useMediaQuery';

import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';

import { fetchShareableConversation } from '@/utils/app/api';
import { cleanConversationHistory } from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { updateConversationLastUpdatedAtTimeStamp } from '@/utils/app/conversation';
import { trackEvent } from '@/utils/app/eventTracking';
import { enableTracking } from '@/utils/app/eventTracking';
import { saveFolders } from '@/utils/app/folders';
import { convertMarkdownToText } from '@/utils/app/outputLanguage';
import { savePrompts } from '@/utils/app/prompts';
import { syncData } from '@/utils/app/sync';
import { getIsSurveyFilledFromLocalStorage } from '@/utils/app/ui';
import { deepEqual } from '@/utils/app/ui';
import { userProfileQuery } from '@/utils/server/supabase';

import { Conversation } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { LatestExportFormat } from '@/types/export';
import { FolderInterface, FolderType } from '@/types/folder';
import { OpenAIModelID, OpenAIModels, fallbackModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import FeaturesModel from '@/components/Features/FeaturesModel';
import { useAzureTts } from '@/components/Hooks/useAzureTts';
import { useFetchCreditUsage } from '@/components/Hooks/useFetchCreditUsage';
import { Navbar } from '@/components/Mobile/Navbar';
import NewsModel from '@/components/News/NewsModel';
import Promptbar from '@/components/Promptbar';
import { AuthModel } from '@/components/User/AuthModel';
import { ProfileUpgradeModel } from '@/components/User/ProfileUpgradeModel';
import ReferralModel from '@/components/User/ReferralModel';
import { SurveyModel } from '@/components/User/SurveyModel';
import { UsageCreditModel } from '@/components/User/UsageCreditModel';
import VoiceInputActiveOverlay from '@/components/VoiceInput/VoiceInputActiveOverlay';

import HomeContext from './home.context';
import { HomeInitialState, initialState } from './home.state';

import dayjs from 'dayjs';
import mixpanel from 'mixpanel-browser';
import { v4 as uuidv4 } from 'uuid';

const Home = () => {
  const defaultModelId = fallbackModelID;
  const { t } = useTranslation('chat');
  const { getModels } = useApiService();
  const { getModelsError } = useErrorService();
  const { isLoading, isPlaying, currentSpeechId, speak, stopPlaying } =
    useAzureTts();
  const [containerHeight, setContainerHeight] = useState('100vh');
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
      temperature,
      showLoginSignUpModel,
      showProfileModel,
      showReferralModel,
      showUsageModel,
      showSurveyModel,
      showNewsModel,
      showFeaturesModel,
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

  const { data, error } = useQuery(
    ['GetModels'],
    ({ signal }) => {
      return getModels(signal);
    },
    { enabled: true, refetchOnMount: false },
  );

  useEffect(() => {
    if (data) dispatch({ field: 'models', value: data });
  }, [data, dispatch]);

  useEffect(() => {
    dispatch({ field: 'modelError', value: getModelsError(error) });
  }, [dispatch, error, getModelsError]);

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

    const lastConversation = conversations[conversations.length - 1];

    const newConversation: Conversation = getNewConversation();

    const updatedConversations = [...conversations, newConversation];

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
    document.documentElement.style.overflow = (showChatbar || showPromptbar)
      ? 'hidden'
      : 'auto';
  }, [showChatbar, showPromptbar]);

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
              value: selectedConversationFromRemote,
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
  ]);

  // USER AUTH ------------------------------------------
  useEffect(() => {
    if (session?.user) {
      userProfileQuery(supabase, session.user.id)
        .then((userProfile) => {
          dispatch({ field: 'showLoginSignUpModel', value: false });
          dispatch({ field: 'isPaidUser', value: userProfile.plan !== 'free' });
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
            },
          });
          if (enableTracking) {
            mixpanel.identify(session.user.id);
            mixpanel.people.union({
              Email: session.user.email,
              Plan: userProfile.plan || 'free',
            });
          }
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
    fetchAndUpdateCreditUsage(user.id, isPaidUser);
  }, [user, isPaidUser, conversations]);

  const handleUserLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ field: 'user', value: null });
    dispatch({ field: 'showProfileModel', value: false });
    toast.success(t('You have been logged out'));
  };

  // ON LOAD --------------------------------------------

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);

      // If you want to set the height directly in the state
      setContainerHeight(`${window.innerHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

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

    const folders = localStorage.getItem('folders');
    if (folders) {
      dispatch({ field: 'folders', value: JSON.parse(folders) });
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      dispatch({ field: 'prompts', value: JSON.parse(prompts) });
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
    let cleanedConversationHistory: Conversation[] = [];
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );
      dispatch({ field: 'conversations', value: cleanedConversationHistory });
    }

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

  return (
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
      }}
    >
      <Head>
        <title>Chat Everywhere</title>
        <meta name="description" content="Use ChatGPT anywhere" />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {selectedConversation && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
          style={{ height: containerHeight }}
        >
          <Navbar
            selectedConversation={selectedConversation}
            onNewConversation={handleNewConversation}
          />

          <div className="flex items-stretch flex-1 w-full overflow-x-hidden">
            <Chatbar />
            <div className="flex flex-1">
              <Chat stopConversationRef={stopConversationRef} />
            </div>
            {showLoginSignUpModel && (
              <AuthModel
                supabase={supabase}
                onClose={() =>
                  dispatch({ field: 'showLoginSignUpModel', value: false })
                }
              />
            )}
            {showProfileModel && (
              <ProfileUpgradeModel
                onClose={() =>
                  dispatch({ field: 'showProfileModel', value: false })
                }
              />
            )}
            {showReferralModel && (
              <ReferralModel
                onClose={() =>
                  dispatch({ field: 'showReferralModel', value: false })
                }
              />
            )}

            {showUsageModel && session && (
              <UsageCreditModel
                onClose={() =>
                  dispatch({ field: 'showUsageModel', value: false })
                }
              />
            )}
            {showSurveyModel && (
              <SurveyModel
                onClose={() =>
                  dispatch({ field: 'showSurveyModel', value: false })
                }
              />
            )}
            <NewsModel
              open={showNewsModel}
              onOpen={() => dispatch({ field: 'showNewsModel', value: true })}
              onClose={() => dispatch({ field: 'showNewsModel', value: false })}
            />

            <FeaturesModel
              open={showFeaturesModel}
              onClose={() =>
                dispatch({ field: 'showFeaturesModel', value: false })
              }
            />
            <Promptbar />
          </div>
          <VoiceInputActiveOverlay />
        </main>
      )}
    </HomeContext.Provider>
  );
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'model',
        'markdown',
        'promptbar',
        'prompts',
        'roles',
        'rolesContent',
        'feature',
        'survey',
        'news',
        'features',
        'auth',
      ])),
    },
  };
};
