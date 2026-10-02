import {
	App,
	PluginSettingTab,
	requireApiVersion,
	Setting,
	SettingDefinitionBase,
	SettingDefinitionItem,
	SettingDropdownControl,
	SettingFolderControl,
	SettingTextControl,
	SettingToggleControl,
} from 'obsidian';
import type AudioRecorderPlugin from '../main';
import type { AudioRecorderSettings } from '../settings';

type Key = keyof AudioRecorderSettings;

type Control =
	| SettingDropdownControl<Key>
	| SettingToggleControl<Key>
	| SettingTextControl<Key>
	| SettingFolderControl<Key>;

interface Definition extends SettingDefinitionBase {
	visible?: () => boolean;
	control: Control;
}

interface Group {
	type: 'group';
	heading: string;
	items: Definition[];
}

const trimSlashes = (path: string) => path.trim().replace(/^\/+|\/+$/g, '');

/** Clean up user input before it is saved. */
function normalize(key: Key, value: unknown): unknown {
	switch (key) {
		case 'folder':
		case 'recordingsFolder':
			return trimSlashes(String(value));
		case 'tag':
			return String(value).trim().replace(/^#/, '');
		default:
			return value;
	}
}

export class AudioRecorderSettingTab extends PluginSettingTab {
	plugin: AudioRecorderPlugin;

	constructor(app: App, plugin: AudioRecorderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** Declarative settings, rendered and indexed for search by Obsidian 1.13+. */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.definitions();
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.save(key as Key, value);
		// Show or hide the folder and tag rows when the scope changes.
		if (requireApiVersion('1.13.0')) this.refreshDomState();
	}

	/** Fallback for Obsidian versions before 1.13, which don't call getSettingDefinitions(). */
	display(): void {
		this.renderFallback();
	}

	private renderFallback() {
		const { containerEl } = this;
		containerEl.empty();

		for (const group of this.definitions()) {
			new Setting(containerEl).setName(group.heading).setHeading();
			for (const def of group.items) {
				if (def.visible && !def.visible()) continue;
				this.renderFallbackSetting(def);
			}
		}
	}

	private definitions(): Group[] {
		const { settings } = this.plugin;
		return [
			{
				type: 'group',
				heading: 'Button',
				items: [
					{
						name: 'Show the button on',
						desc: 'Which notes show the floating record button.',
						control: {
							type: 'dropdown',
							key: 'scope',
							options: { all: 'All notes', folder: 'Notes in a folder', tag: 'Notes with a tag' },
						},
					},
					{
						name: 'Folder',
						desc: 'Subfolders are included.',
						visible: () => settings.scope === 'folder',
						control: { type: 'folder', key: 'folder', placeholder: 'Meetings' },
					},
					{
						name: 'Tag',
						desc: 'With or without "#". Nested tags also match.',
						visible: () => settings.scope === 'tag',
						control: { type: 'text', key: 'tag', placeholder: 'Meeting' },
					},
					{
						name: 'Show in the left sidebar',
						desc: 'Add a record button to the ribbon. It starts and stops recording for the open note.',
						aliases: ['ribbon', 'microphone'],
						control: { type: 'toggle', key: 'showRibbonIcon' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Recordings',
				items: [
					{
						name: 'Recordings folder',
						desc: "Leave empty to use Obsidian's attachment location.",
						aliases: ['attachments', 'audio'],
						control: { type: 'folder', key: 'recordingsFolder', placeholder: 'Recordings' },
					},
					{
						name: 'Insert recording',
						desc: 'Where the embed is added in the note when a recording is saved.',
						aliases: ['embed', 'link'],
						control: {
							type: 'dropdown',
							key: 'insertPosition',
							options: {
								end: 'At the end of the note',
								cursor: 'At the editing position (if the note is open)',
							},
						},
					},
				],
			},
		];
	}

	private async save(key: Key, value: unknown) {
		(this.plugin.settings as unknown as Record<Key, unknown>)[key] = normalize(key, value);
		await this.plugin.saveSettings();
	}

	private renderFallbackSetting(def: Definition) {
		const { control } = def;
		const value = this.plugin.settings[control.key];
		const setting = new Setting(this.containerEl).setName(def.name).setDesc(def.desc ?? '');

		switch (control.type) {
			case 'dropdown':
				setting.addDropdown((dd) =>
					dd
						.addOptions(control.options)
						.setValue(String(value))
						.onChange(async (v) => {
							await this.save(control.key, v);
							this.renderFallback();
						}),
				);
				break;
			case 'toggle':
				setting.addToggle((toggle) =>
					toggle.setValue(Boolean(value)).onChange((v) => this.save(control.key, v)),
				);
				break;
			case 'text':
			case 'folder':
				setting.addText((text) =>
					text
						.setPlaceholder(control.placeholder ?? '')
						.setValue(String(value))
						.onChange((v) => this.save(control.key, v)),
				);
				break;
		}
	}
}
