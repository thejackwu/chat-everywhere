import React, { useRef } from "react";
import { IconPaperclip } from "@tabler/icons-react";
import { Attachment, AttachmentCollection } from "@/types/attachment";

const AttachFilesButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent): void => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files) return;

    createAttachments(files, (attachments: AttachmentCollection) => {
      console.log(attachments);
      const jsonString = JSON.stringify(attachments);
      localStorage.setItem('attachments', jsonString);
      console.log('Files saved locally');
    });
  };

  const createAttachments = (files: FileList, onDone: (attachments: AttachmentCollection) => void) => {
    const attachments: AttachmentCollection = {};
    let filesToRead = files?.length;

    for (let i = 0; i < files?.length; i++) {
      const reader = new FileReader();
      const file = files[i];

      reader.onload = () => {
        if (reader.result != null) {
          attachments[file.name] = {
            name: file.name,
            content: reader.result as string,
          };
        }
        filesToRead -= 1;
        if (filesToRead <= 0) onDone(attachments);
      };

      reader.readAsText(file);
    }
  };

  return (
    <div>
      <button
        className="p-1 text-zinc-500 bg-white dark:text-zinc-400 dark:bg-[#40414F] rounded-sm"
        onClick={handleClick}
      >
        <IconPaperclip size={18}/>
      </button>
      <input
        accept="text/csv,text/plain"
        className="hidden"
        multiple
        onChange={handleChange}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
};

export default AttachFilesButton;
