import { Plugin } from 'obsidian';
import { AudioRecorderSettings, loadSettings } from './settings';
import { AudioRecorderSettingTab } from './ui/settings-tab';
import { registerCommands } from './commands';
import { RecordingController } from './recording-controller';

export default class AudioRecorderPlugin extends Plugin {
	settings!: AudioRecorderSettings;
	controller!: RecordingController;
	private ribbonIcon: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.controller = new RecordingController(this);
		this.addSettingTab(new AudioRecorderSettingTab(this.app, this));
		registerCommands(this, this.controller);

		const refresh = () => this.controller.refreshVisibility();
		this.registerEvent(this.app.workspace.on('active-leaf-change', refresh));
		this.registerEvent(this.app.workspace.on('file-open', refresh));
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file === this.app.workspace.getActiveFile()) refresh();
			}),
		);
		this.registerEvent(this.app.vault.on('rename', refresh));
		this.app.workspace.onLayoutReady(refresh);
		this.updateRibbonIcon();
	}

	onunload() {
		this.controller.destroy();
	}

	async loadSettings() {
		this.settings = loadSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.controller.refreshVisibility();
		this.updateRibbonIcon();
	}

	/** Add or remove the left sidebar record button to match the setting. */
	private updateRibbonIcon() {
		if (this.settings.showRibbonIcon && !this.ribbonIcon) {
			this.ribbonIcon = this.addRibbonIcon('mic', 'Start/stop recording', () =>
				this.controller.toggleRecording(),
			);
		} else if (!this.settings.showRibbonIcon && this.ribbonIcon) {
			this.ribbonIcon.remove();
			this.ribbonIcon = null;
		}
	}
}
