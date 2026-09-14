import type { AssetKind, CanonicalStatus, FilmAsset } from '../asset-builder/types';
import type { FilmOSShot } from '../types';

export type LibraryAssetKind = AssetKind | 'keyframe' | 'video';
export type MediaAvailability = 'available' | 'unavailable' | 'pending';

/**
 * Media-first projection of the canonical production records.  It intentionally
 * does not invent a thumbnail: unavailable media stays unavailable in the UI.
 */
export type FilmLibraryAsset = {
  id: string;
  kind: LibraryAssetKind;
  name: string;
  status: CanonicalStatus;
  version?: string;
  continuityNote: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaAvailability?: MediaAvailability;
  ownerCharacterId?: string;
  usedInShotIds?: string[];
  canonical?: boolean;
  createdAt?: string;
  checksum?: string;
  model?: string;
  sourceAssetId?: string;
};

export const libraryKindLabels: Record<LibraryAssetKind, string> = {
  character: 'דמויות',
  prop: 'אביזרים',
  location: 'לוקיישנים',
  keyframe: 'Keyframes',
  video: 'וידאו',
};

export const libraryStatusLabels: Record<CanonicalStatus, string> = {
  approved: 'מאושר',
  review: 'לריוויו',
  draft: 'טיוטה',
  blocked: 'חסום',
};

export function hasUsableMedia(asset: Pick<FilmLibraryAsset, 'mediaUrl' | 'mediaAvailability'>) {
  if (asset.mediaAvailability && asset.mediaAvailability !== 'available') return false;
  return Boolean(asset.mediaUrl && /^(https?:|data:image\/|blob:)/.test(asset.mediaUrl));
}

/** Adapter for the existing canonical asset-builder records. */
export function libraryAssetFromFilmAsset(asset: FilmAsset): FilmLibraryAsset {
  const mediaUrl = asset.thumbnailUrl ?? asset.referenceUrl;
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    status: asset.status,
    version: asset.version,
    continuityNote: asset.continuityNote,
    mediaUrl,
    mediaType: 'image',
    mediaAvailability: mediaUrl ? 'available' : 'unavailable',
    ownerCharacterId: asset.ownerCharacterId,
    usedInShotIds: asset.usedInShotIds,
    canonical: asset.status !== 'draft',
    sourceAssetId: asset.id,
  };
}

/** Adapters preserve the real keyframe/video URLs already attached to a shot. */
export function libraryAssetsFromShot(shot: FilmOSShot): FilmLibraryAsset[] {
  const base = {
    usedInShotIds: [shot.id],
    status: shot.status === 'revise' ? 'review' as const : shot.status,
    canonical: shot.status === 'approved',
    continuityNote: shot.synopsis ?? 'ללא תקציר הפקה.',
    model: shot.model,
  };
  return [
    {
      ...base,
      id: `${shot.id}_KEYFRAME_${shot.version ?? 'UNVERSIONED'}`,
      kind: 'keyframe',
      name: `${shot.title} · keyframe`,
      version: shot.version,
      mediaUrl: shot.thumbnailUrl,
      mediaType: 'image',
      mediaAvailability: shot.thumbnailUrl ? 'available' : 'unavailable',
      sourceAssetId: shot.id,
    },
    {
      ...base,
      id: `${shot.id}_VIDEO_${shot.version ?? 'UNVERSIONED'}`,
      kind: 'video',
      name: `${shot.title} · render`,
      version: shot.version,
      mediaUrl: shot.videoUrl,
      mediaType: 'video',
      mediaAvailability: shot.videoUrl ? 'available' : 'unavailable',
      sourceAssetId: shot.id,
    },
  ];
}

