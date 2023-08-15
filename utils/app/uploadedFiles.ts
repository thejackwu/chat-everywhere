import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Papa from 'papaparse';
import { downloadZip } from 'client-zip';

import { UploadedFile, UploadedFileMap } from '@/types/uploadedFile';

dayjs.extend(utc);

export const sortByName = (a: UploadedFile | string, b: UploadedFile | string): number => {
  const nameA: string = typeof a === 'string' ? a : a.name;
  const nameB: string = typeof b === 'string' ? b : b.name;
  return nameA.toUpperCase() < nameB.toUpperCase() ? -1 : 1;
};

export const validateFilename = (filename: string): boolean => {
  return !filename.match(/[\\/:"*?<>|]+/);
};

// Extracts the file name from a path
const filenameFromPath = (path: string): string | null => {
  const substrings = path.split('/');
  if (substrings.length === 0) return null;
  return substrings[substrings.length - 1];
};

const download = async (filenames: string[], userToken?: string): Promise<Blob> => {
  if (userToken) {
    const csvFilenames = Papa.unparse<string[]>([filenames]);
    const res = await fetch(`/api/files?download=${encodeURIComponent(csvFilenames)}`, {
      headers: { 'user-token': userToken },
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return await res.blob();
  } else {
    const data = localStorage.getItem('files') || '{}';
    let uploadedFiles!: UploadedFileMap;

    try {
      uploadedFiles = JSON.parse(data);
    } catch (error) {
      throw new Error('Unable to retrieve files');
    }

    if (filenames.length === 0) {
      throw new Error('No specified files to download');
    }

    if (filenames.length > 1) {
      const files: File[] = [];

      for (const filename of filenames) {
        const file = uploadedFiles[filename];
        if (!file) throw new Error(`Unable to find ${filename}`);
        files.push(new File([file.content], `ChatEverywhere/${filename}`, { type: file.type }));
      }

      return await downloadZip(files).blob();
    }

    const file = uploadedFiles[filenames[0]];
    if (!file) throw new Error(`Unable to find ${filenames[0]}`);
    return new Blob([file.content], { type: file.type });
  }
};

// When loading files from local storage, all the files are fetched (no pagination).
const load = async (
  userToken?: string,
  next: string | null = null,
  query: string = '',
): Promise<{ files: UploadedFile[], next: string | null }> => {
  query = query?.toUpperCase().trim();

  if (userToken) {
    const res = await fetch(`/api/files?next=${encodeURIComponent(next || '')}&query=${encodeURIComponent(query)}`, {
      headers: { 'user-token': userToken },
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return await res.json();
  } else {
    const data = localStorage.getItem('files');
    if (!data) return { files: [], next: null };

    let uploadedFiles!: UploadedFileMap;
    try {
      uploadedFiles = JSON.parse(data);
    } catch (error) {
      throw new Error('Unable to retrieve files');
    }

    if (query) {
      const filteredUploadedFiles: UploadedFile[] = [];
      for (const file of Object.values(uploadedFiles)) {
        if (file.name.toUpperCase().includes(query)) {
          filteredUploadedFiles.push(file);
        }
      }
      return { files: filteredUploadedFiles.sort(sortByName), next: null };
    } else {
      const sortedUploadedFiles = Object.values(uploadedFiles).sort(sortByName);
      return { files: sortedUploadedFiles, next: null };
    }
  }
};

const openUploadWindow = async (): Promise<FileList> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type='file';
    input.accept = 'text/plain';
    input.multiple = true;
    input.onchange = (event: Event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) {
        resolve(new FileList());
      } else {
        resolve(files);
      }
    };
    input.click();
  });
};

const read = async (
  filename: string,
  userToken?: string,
): Promise<string> => {
  if (userToken) {
    const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      headers: { 'user-token': userToken },
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    if (!res.body) {
      return '';
    }

    const blob = await res.blob();
    return await blob.text();
  } else {
    const data = localStorage.getItem('files');
    if (!data) throw new Error('Couldn\'t find file');
    
    let uploadedFiles!: UploadedFileMap;
    try {
      uploadedFiles = JSON.parse(data);
    } catch (error) {
      throw new Error('Unable to retrieve file');
    }
  
    const file = uploadedFiles[filename];
    if (!file) throw new Error('Couldn\'t find file');

    return file.content;
  }
};

const remove = async (filenames: string[], userToken?: string): Promise<void> => {
  if (userToken) {
    const csvFilenames = Papa.unparse<string[]>([filenames]);
    const res = await fetch(`/api/files?names=${encodeURIComponent(csvFilenames)}`, {
      headers: { 'user-token': userToken },
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
  } else {
    const data = localStorage.getItem('files');
    if (!data) return;
  
    let uploadedFiles!: UploadedFileMap;
    
    try {
      uploadedFiles = JSON.parse(data);
    } catch (error) {
      throw new Error('Unable to retrieve files');
    }
    
    const updatedUploadedFiles =  { ...uploadedFiles };
  
    for (const filename of filenames) {
      delete updatedUploadedFiles[filename];
    }
  
    const jsonString = JSON.stringify(updatedUploadedFiles);
    localStorage.setItem('files', jsonString);
  }
};

const rename = async (filename: string, newName: string, userToken?: string): Promise<string> => {
  if (newName === filename) {
    return filename;
  }

  if (newName.length === 0) {
    throw new Error('Filename cannot be empty');
  }

  if (!validateFilename(newName)) {
    throw new Error('Filename cannot contain the following characters: \\/:"*?<>|');
  }

  if (userToken) {
    const res = await fetch(`/api/files/${filename}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'user-token': userToken,
      },
      body: JSON.stringify({ new_name: newName }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return newName;
  } else {
    const data = localStorage.getItem('files');
    if (!data) {
      throw new Error('File doesn\'t exist');
    }
  
    let uploadedFiles!: UploadedFileMap;
    
    try {
      uploadedFiles = JSON.parse(data);
    } catch (error) {
      throw new Error('Unable to rename file');
    }

    if (!uploadedFiles[filename]) {
      throw new Error('File doesn\'t exist');
    }
  
    if (uploadedFiles[newName]) {
      throw new Error('Another file with that name already exists');
    }
  
    const updatedUploadedFiles = { ...uploadedFiles };
  
    updatedUploadedFiles[newName] = {
      ...uploadedFiles[filename],
      name: newName,
      updatedAt: dayjs().toISOString(),
    };
    delete updatedUploadedFiles[filename];
  
    const jsonString = JSON.stringify(updatedUploadedFiles);
    localStorage.setItem('files', jsonString);

    return newName;
  }
};

// Uploads the files already saved locally to the server, and deletes the
// local files. Returns null upon success, otherwise, returns an array containing
// the files that failed to upload.
const syncLocal = async (userToken: string): Promise<null | any[]> => {
  const { files: localFiles } = await load();

  const files: File[] = [];
  for (const localFile of localFiles) {
    const file = new File(
      [localFile.content],
      localFile.name,
      {
        type: localFile.type,
        lastModified: dayjs(localFile.updatedAt).valueOf(),
      }
    );
    files.push(file);
  }

  if (!files.length) {
    return null;
  }

  const { errors } = await upload(files, userToken, true);
  if (errors.length > 0) {
    return errors;
  }

  await remove(files.map((file) => file.name));
  return null;
};

const upload = async (
  files: FileList | File[],
  userToken: string | null = null,
  sync: boolean = false,
): Promise<{ files: UploadedFileMap, errors: { filename: string, message: string }[] }> => {
  let uploadedFiles = await createUploadedFiles(files);
  let errors: { filename: string, message: string }[] = [];

  if (!files) return { files: {}, errors: [] };

  if (userToken) {
    const formData = new FormData();
    const fileData: any = { updatedAt: {} };
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      formData.append('files[]', file, file.name);
      fileData.updatedAt[file.name] = file.lastModified;
    }

    formData.append('sync', sync ? 'true' : 'false');
    formData.append('file_data', JSON.stringify(fileData));
  
    const res = await fetch('/api/files/', {
      method: 'POST',
      body: formData,
      headers: { 'user-token': userToken },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    for (const error of json.errors) {
      // Remove the files that failed to upload
      delete uploadedFiles[error.filename];
    }
    errors = json.errors;
  } else {
    const data = localStorage.getItem('files');
    let updatedUploadedFiles: UploadedFileMap = {};
  
    if (data) {
      const existingUploadedFiles = JSON.parse(data) as UploadedFileMap;
      updatedUploadedFiles = {
        ...existingUploadedFiles,
        ...uploadedFiles,
      };
    } else {
      updatedUploadedFiles = {
        ...uploadedFiles,
      };
    }
  
    const jsonString = JSON.stringify(updatedUploadedFiles);
    localStorage.setItem('files', jsonString);
  }

  return { files: uploadedFiles, errors };
};

// Returns true when successful, otherwise, false.
const write = async (filename: string, content: string, userToken?: string): Promise<boolean> => {
  if (userToken) {
    const file = new File([content], filename, { type: 'text/plain' });

    const formData = new FormData();
    formData.append('files[]', file, file.name);

    const res = await fetch('/api/files/', {
      method: 'POST',
      body: formData,
      headers: { 'user-token': userToken },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    return json.errors.length === 0;
  } else {
    const data = localStorage.getItem('files') || '{}';
  
    let existingUploadedFiles!: UploadedFileMap;
    try {
      existingUploadedFiles = JSON.parse(data) as UploadedFileMap;
    } catch (error) {
      existingUploadedFiles = {};
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const now = dayjs().toISOString();
  
    const updatedUploadedFiles: UploadedFileMap = {
      ...existingUploadedFiles,
      [filename]: {
        name: filename,
        content,
        size: blob.size,
        type: blob.type,
        createdAt: existingUploadedFiles[filename]
          ? existingUploadedFiles[filename].createdAt
          : now,
        updatedAt: now,
      },
    };
  
    const jsonString = JSON.stringify(updatedUploadedFiles);
    localStorage.setItem('files', jsonString);
    return true;
  }
};

const createUploadedFiles = async (files: FileList | File[]): Promise<UploadedFileMap> => {
  return new Promise<UploadedFileMap>((resolve) => {
    const uploadedFiles: UploadedFileMap = {};
    let filesToRead: number = files?.length || 0;

    if (filesToRead === 0) {
      resolve({});
    }

    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      const file = files[i];
  
      reader.onload = () => {
        if (reader.result != null) {
          const now = dayjs().toISOString();

          uploadedFiles[file.name] = {
            name: file.name,
            content: reader.result as string,
            size: file.size,
            type: file.type,
            createdAt: now,
            updatedAt: now,
          };
        }

        filesToRead -= 1;
        if (filesToRead <= 0) resolve(uploadedFiles);
      };

      reader.readAsText(file);
    }
  });
};

export const UploadedFiles = {
  filenameFromPath,
  download,
  load,
  openUploadWindow,
  read,
  remove,
  rename,
  syncLocal,
  upload,
  write,
};