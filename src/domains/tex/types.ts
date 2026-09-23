export interface TexProject {
  projectKey: string;
  name: string;
  versionNo: string;
  url: string;
}

export interface TexProjectPage {
  items: TexProject[];
  hasMore: boolean;
}

export interface TexFile {
  fileKey: string;
  path: string;
  isDir: boolean;
}
