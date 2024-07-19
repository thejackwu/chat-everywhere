import { IconCheck, IconClipboard, IconDownload } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { useTranslation } from 'next-i18next';

import {
  generateRandomString,
  programmingLanguages,
} from '@/utils/app/codeblock';

interface Props {
  language: string;
  value: string;
}

export const CodeBlock: FC<Props> = memo(({ language, value }) => {
  const { t } = useTranslation('markdown');
  const [isCopied, setIsCopied] = useState<Boolean>(false);

  const disableButtonsForLanguageTags = ['MJImage'];

  const copyToClipboard = () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  const downloadAsFile = () => {
    const fileExtension = programmingLanguages[language] || '.file';
    const suggestedFileName = `file-${generateRandomString(
      3,
      true,
    )}${fileExtension}`;
    const fileName = window.prompt(
      t('Enter file name') || '',
      suggestedFileName,
    );

    if (!fileName) {
      // user pressed cancel on prompt
      return;
    }

    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderActionButtons = (): JSX.Element | null => {
    if (disableButtonsForLanguageTags.includes(language)) return null;

    return (
      <div className="flex items-center">
        <button
          className="flex items-center gap-1.5 rounded bg-none p-1 text-xs text-white"
          onClick={copyToClipboard}
        >
          {isCopied ? (
            <IconCheck
              className="text-green-500 dark:text-green-400"
              size={18}
            />
          ) : (
            <IconClipboard size={18} />
          )}
        </button>
        <button
          className="flex items-center rounded bg-none p-1 text-xs text-white"
          onClick={downloadAsFile}
        >
          <IconDownload size={18} />
        </button>
      </div>
    );
  };

  return (
    <div className="codeblock relative font-sans text-[16px]">
      <div className="flex items-center justify-between px-4 py-1">
        <span className="text-xs lowercase text-white">{language}</span>
        {renderActionButtons()}
      </div>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0 }}
      >
        {value}
      </SyntaxHighlighter>

      {value.length > 500 && (
        <div className="flex justify-end px-4 py-1">
          {renderActionButtons()}
        </div>
      )}
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
