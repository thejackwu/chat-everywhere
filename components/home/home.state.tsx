import type { Conversation, Message } from '@/types/chat';
import type { DragData } from '@/types/drag';
import type { ErrorMessage } from '@/types/error';
import type { FolderInterface } from '@/types/folder';
import type { OpenAIModelID } from '@/types/openai';
import type { Prompt, TeacherPromptForTeacherPortal } from '@/types/prompt';
import type { TeacherSettings } from '@/types/teacher-settings';
import type { CreditUsage, User } from '@/types/user';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface HomeInitialState {
  appInitialized: boolean;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  folders: FolderInterface[];
  conversations: Conversation[];
  selectedConversation: Conversation | undefined;
  currentMessage: Message | undefined;
  prompts: Prompt[];
  temperature: number;
  showChatbar: boolean;
  showPromptbar: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  defaultModelId: OpenAIModelID | undefined;
  outputLanguage: string;
  currentDrag: DragData | undefined;

  // Supabase / Cloud Sync
  supabaseClient: SupabaseClient | null;
  conversationLastSyncAt: number | null;
  conversationLastUpdatedAt: number | null;
  forceSyncConversation: boolean;
  replaceRemoteData: boolean;
  syncingConversation: boolean;
  syncSuccess: boolean | null; // null = not yet synced

  // Request Logout
  isRequestingLogout: {
    clearBrowserChatHistory: boolean;
  } | null;

  // User Auth
  showSettingsModel: boolean;
  showFilePortalModel: boolean;
  showLoginSignUpModel: boolean;
  showOneTimeCodeLoginModel: boolean;
  showReferralModel: boolean;
  showUsageModel: boolean;
  showSurveyModel: boolean;
  showNewsModel: boolean;
  showFeaturesModel: boolean;
  showEventModel: boolean;
  showClearConversationsModal: boolean;
  showClearPromptsModal: boolean;
  showFeaturePageOnLoad: string | null;
  user: User | null;
  isPaidUser: boolean;
  isUltraUser: boolean;
  isTempUser: boolean;
  isTeacherAccount: boolean;

  // Plugins Utils
  creditUsage: CreditUsage | null;
  hasMqttConnection: boolean;
  isConnectedWithLine: boolean;

  // Speech
  speechRecognitionLanguage: string;

  // Teacher Portal
  teacherPrompts: TeacherPromptForTeacherPortal[];
  teacherSettings: TeacherSettings;

  // Posthog feature flags
  // featureFlags: {
  //   'enable-conversation-mode': boolean;
  // };
}

export const initialState: HomeInitialState = {
  appInitialized: false,
  loading: false,
  lightMode: 'dark',
  messageIsStreaming: false,
  modelError: null,
  folders: [],
  conversations: [],
  selectedConversation: undefined,
  currentMessage: undefined,
  prompts: [],
  temperature: 1,
  showPromptbar: false,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  defaultModelId: undefined,
  outputLanguage: '',
  currentDrag: undefined,

  // Supabase / Cloud Sync
  supabaseClient: null,
  conversationLastSyncAt: null,
  conversationLastUpdatedAt: null,
  forceSyncConversation: true, // Sync on first load
  replaceRemoteData: false,
  syncingConversation: false,
  syncSuccess: null,

  // Request Logout
  isRequestingLogout: null,

  // User Auth
  showSettingsModel: false,
  showFilePortalModel: false,
  showLoginSignUpModel: false,
  showOneTimeCodeLoginModel: false,
  showReferralModel: false,
  showUsageModel: false,
  showSurveyModel: false,
  showNewsModel: false,
  showFeaturesModel: false,
  showEventModel: false,
  showClearConversationsModal: false,
  showClearPromptsModal: false,
  showFeaturePageOnLoad: null,
  user: null,
  isPaidUser: false,
  isUltraUser: false,
  isTempUser: false,
  isTeacherAccount: false,

  // Plugins Utils
  creditUsage: null,
  hasMqttConnection: false,
  isConnectedWithLine: false,

  // Speech
  speechRecognitionLanguage: 'en-US',

  // Teacher Portal
  teacherPrompts: [],
  teacherSettings: {
    allow_student_use_line: false,
    hidden_chateverywhere_default_character_prompt: false,
  },

  // Posthog feature flags
  // featureFlags: {
  //   'enable-conversation-mode': false,
  // },
};
