export type Scope = 'all' | 'folder' | 'tag';
export type InsertPosition = 'cursor' | 'end';

export interface AudioRecorderSettings {
	/** Which notes show the floating button. */
	scope: Scope;
	/** Folder path used when scope is 'folder'. Subfolders are included. */
	folder: string;
	/** Tag without the leading '#', used when scope is 'tag'. Nested tags also match. */
	tag: string;
	/** Whether to add a record button to the left sidebar ribbon. */
	showRibbonIcon: boolean;
	/** Where recordings are saved. Empty = use Obsidian's attachment location. */
	recordingsFolder: string;
	/** Where the embed link is inserted in the note. */
	insertPosition: InsertPosition;
}

export const DEFAULT_SETTINGS: AudioRecorderSettings = {
	scope: 'all',
	folder: '',
	tag: '',
	showRibbonIcon: true,
	recordingsFolder: '',
	insertPosition: 'end',
};

/** Merge saved data with defaults. */
export function loadSettings(data: unknown): AudioRecorderSettings {
	return Object.assign({}, DEFAULT_SETTINGS, data as Partial<AudioRecorderSettings> | null);
}
