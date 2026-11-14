export enum ContentCategory {
  PODCAST = 'Podcast',
  SPORTS = 'Sports',
  TECHNOLOGY = 'Technology',
  ENTERTAINMENT = 'Entertainment',
  EDUCATIONAL = 'Educational',
  MOTIVATIONAL = 'Motivational',
  MUSIC = 'Music',
  NEWS = 'News',
}

export interface ScriptData {
  title: string;
  hook: string;
  script_body: string;
  cta: string;
  visual_cues: string[];
  hashtags: string[];
}

export interface GeneratedAsset {
  type: 'script' | 'image';
  data: ScriptData | string; // ScriptData object or base64 image string
}

export type ViewState =
  | 'HOME'
  | 'GENERATOR'
  | 'PODCAST'
  | 'TEXT_HIGHLIGHTER'
  | 'MUSIC'
  | 'MOTIVATIONAL'
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'NEWS';
