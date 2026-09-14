import type { ReactNode } from 'react';

/** The canonical, provider-neutral shapes consumed by the Film OS UI. */
export type FilmOSStatus = 'approved' | 'review' | 'revise' | 'blocked' | 'draft';

export type FilmOSShot = {
  id: string;
  title: string;
  synopsis?: string;
  startSeconds: number;
  endSeconds: number;
  status: FilmOSStatus;
  /** A real, decodable keyframe URL. Omit rather than pass a mock image. */
  thumbnailUrl?: string;
  sourceThumbnailUrl?: string;
  /** The user-selected playable render, if one exists. */
  videoUrl?: string;
  version?: string;
  model?: string;
  audioMode?: 'silent' | 'native-audio' | 'voice-over' | 'lip-sync';
  continuityRisk?: 'low' | 'medium' | 'high';
  characterIds?: string[];
  propIds?: string[];
  locationId?: string;
  keyframeOptions?: Array<{ id: string; version: string; url: string; active: boolean }>;
};

export type FilmOSNavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

export type FilmOSInspectorTab = 'details' | 'continuity' | 'prompt' | 'versions';

export type FilmOSShellProps = {
  projectName: string;
  projectMeta?: string;
  navigation: FilmOSNavItem[];
  activeNavigationId: string;
  onNavigate?: (id: string) => void;
  openReviews?: number;
  budgetLabel?: string;
  children: ReactNode;
};
