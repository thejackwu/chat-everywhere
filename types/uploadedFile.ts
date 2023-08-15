export interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFileMap {
  [filename: string]: UploadedFile;
}