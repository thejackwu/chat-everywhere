import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { IconBug } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import React, { useContext, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { Conversation, Message } from '@/types/chat';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import Spinner from '../Spinner';
import HomeContext from '../home/home.context';
import { Button } from '../ui/button';

interface Props {
  conversation: Conversation;
}

const ReportBugForTeacherStudentButton: React.FC<Props> = ({
  conversation,
}) => {
  const {
    state: { isTeacherAccount, isTempUser },
  } = useContext(HomeContext);

  const { t } = useTranslation('common');
  const { t: modelT } = useTranslation('model');
  const [bugDescription, setBugDescription] = useState('');

  const { mutateAsync: reportBug, isLoading } = useReportBugMutation();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await reportBug({
      title: conversation.name,
      prompts: conversation.messages,
      bugDescription,
    });
    setIsOpen(false);
    setBugDescription('');
  };
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {(isTeacherAccount || isTempUser) && (
        <DialogTrigger>
          <IconBug size={20} color="#FFD700" />
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-white">
            {t('Report a bug in this conversation to Chat Everywhere')}
          </DialogTitle>
          <DialogDescription></DialogDescription>

          <form onSubmit={handleSubmit}>
            <textarea
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              style={{ resize: 'none' }}
              placeholder={
                t(
                  'Your report will go directly to our development team, allowing us to resolve your issue as quickly as possible',
                ) || ''
              }
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
              rows={7}
              required
            />
            <div className="flex justify-center pt-4">
              <Button type="submit" disabled={isLoading}>
                <div className="flex items-center gap-2">
                  {isLoading && <Spinner />}
                  {modelT('Submit')}
                </div>
              </Button>
            </div>
          </form>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default ReportBugForTeacherStudentButton;

const useReportBugMutation = () => {
  const supabase = useSupabaseClient();
  const { t: modelT } = useTranslation('model');
  const reportBug = async (bugData: {
    title: string;
    prompts: Message[];
    bugDescription: string;
  }) => {
    const accessToken = (await supabase.auth.getSession())?.data.session
      ?.access_token;
    if (!accessToken) {
      alert('Please sign in to continue');
      return;
    }
    const response = await fetch('/api/report-bug-with-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-token': accessToken,
      },
      body: JSON.stringify(bugData),
    });
    if (!response.ok) {
      throw new Error('Failed to submit bug report');
    }
    return response.json();
  };
  return useMutation<
    unknown,
    Error,
    { title: string; prompts: any[]; bugDescription: string }
  >(reportBug, {
    onSuccess: () => {
      toast.success(modelT('Bug report submitted successfully'));
    },
    onError: () => {
      toast.error('Error submitting bug report');
    },
  });
};
