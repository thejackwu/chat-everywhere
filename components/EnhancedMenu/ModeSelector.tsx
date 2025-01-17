import React, { useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { saveOutputLanguage } from '@/utils/app/outputLanguage';

import { PluginID } from '@/types/plugin';

import HomeContext from '@/components/home/home.context';

const ModeSelector = () => {
  const { t } = useTranslation('model');

  const {
    state: {
      currentMessage,
      isPaidUser,
      hasMqttConnection,
      isUltraUser,
      selectedConversation,
    },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const currentSelectedPluginId = useMemo(() => {
    if (!currentMessage || currentMessage?.pluginId === null) {
      return 'default';
    } else {
      return currentMessage.pluginId;
    }
  }, [currentMessage]);

  const pluginOnChange = (pluginId: string) => {
    // add checker to see if the current conversation has files
    const hasFiles = selectedConversation?.messages.some(
      (message) => message.fileList && message.fileList.length > 0,
    );
    if (hasFiles && pluginId !== PluginID.GEMINI) {
      alert(
        t(
          'Sorry, only the Gemini mode supports files, please clear all files to use other mode.',
        ),
      );
      return;
    }

    homeDispatch({
      field: 'currentMessage',
      value: {
        ...currentMessage,
        pluginId: pluginId === 'default' ? null : pluginId,
        // clear file list if the plugin is not Gemini
        fileList: pluginId === PluginID.GEMINI ? currentMessage?.fileList : [],
      },
    });
  };

  // If the selected conversation has files, and the current selected plugin is not Gemini, switch to Gemini
  useEffect(() => {
    const hasFiles = selectedConversation?.messages.some(
      (message) => message.fileList && message.fileList.length > 0,
    );
    if (hasFiles && currentSelectedPluginId !== PluginID.GEMINI) {
      if (isUltraUser) {
        homeDispatch({
          field: 'currentMessage',
          value: {
            ...currentMessage,
            pluginId: PluginID.GEMINI,
          },
        });
      }
    }
  }, [
    selectedConversation,
    currentSelectedPluginId,
    t,
    homeDispatch,
    currentMessage,
    isUltraUser,
  ]);

  return (
    <div className="flex flex-row items-center justify-between md:justify-start">
      <label className="mr-2 text-left text-sm text-neutral-700 dark:text-neutral-400">
        {t('Mode')}
      </label>
      <div className="w-fit rounded-lg border border-neutral-200 bg-transparent pr-1 text-neutral-900 focus:outline-none dark:border-neutral-600 dark:text-white">
        <select
          data-cy="chat-mode-selector"
          className="bg-transparent p-2 focus:outline-none"
          placeholder={t('Select a lang') || ''}
          value={currentSelectedPluginId}
          onChange={(e) => {
            if (e.target.value === PluginID.LANGCHAIN_CHAT && !isPaidUser) {
              alert(
                t(
                  'Sorry online mode is only for Pro user, please sign up and purchase Pro plan to use this feature.',
                ),
              );
              return;
            }
            homeDispatch({ field: 'outputLanguage', value: 'default' });
            saveOutputLanguage('default');
            pluginOnChange(e.target.value);
          }}
        >
          <option
            value={'default'}
            className="dark:bg-[#343541] dark:text-white"
          >
            {t('Default mode')}
          </option>
          <option
            value={PluginID.LANGCHAIN_CHAT}
            className="dark:bg-[#343541] dark:text-white"
          >
            {t('Online mode')}
          </option>
          {isPaidUser && (
            <>
              <option
                value={PluginID.GPT4}
                className="text-yellow-600 dark:bg-[#343541] dark:text-white"
              >
                {t('GPT-4')}
              </option>
              <option
                value={PluginID.IMAGE_GEN}
                className="text-yellow-600 dark:bg-[#343541] dark:text-white"
              >
                {t('AI Image')}
              </option>
              {hasMqttConnection && (
                <option
                  value={PluginID.mqtt}
                  className="text-yellow-600 dark:bg-[#343541] dark:text-white"
                >
                  {t('MQTT')}
                </option>
              )}
              <option
                value={PluginID.aiPainter}
                className="text-yellow-600 dark:bg-[#343541] dark:text-white"
              >
                {t('AI Painter')}
              </option>
            </>
          )}
          {isUltraUser && (
            <option
              value={PluginID.GEMINI}
              className="text-yellow-600 dark:bg-[#343541] dark:text-white"
            >
              {t('Gemini')}
            </option>
          )}
        </select>
      </div>
    </div>
  );
};

export default ModeSelector;
