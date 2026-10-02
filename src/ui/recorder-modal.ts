import { App, Modal, Platform, setIcon, setTooltip } from 'obsidian';
import type { RecorderState } from '../recorder';
import { formatElapsed } from './floating-button';

export interface RecorderModalHandlers {
	onPauseToggle: () => void;
	onStop: () => void;
	onDiscard: () => void;
	/** Called whenever the dialog closes: minimised, or after stop/discard. */
	onClose: () => void;
}

/** Bar width + gap in the level meter, in px. Must match styles.css. */
const BAR_PITCH = 3 + 4;
const MIN_BAR_HEIGHT = 3;
/** Drag distance that dismisses the mobile sheet. */
const SWIPE_DISMISS_PX = 80;

/**
 * The recorder dialog: target note, live level meter, timer and controls.
 * Closing it (Esc, the chevron, the scrim, or swiping the sheet down) only
 * minimises it; the recording keeps running.
 */
export class RecorderModal extends Modal {
	private noteEl: HTMLElement;
	private meterEl: HTMLElement;
	private bars: HTMLElement[] = [];
	private levels: number[] = [];
	private timeEl: HTMLElement;
	private pauseBtn: HTMLButtonElement;

	constructor(
		app: App,
		private handlers: RecorderModalHandlers,
	) {
		super(app);
		this.containerEl.addClass('audio-recorder-modal-container');
		this.modalEl.addClass('audio-recorder-modal');
		// The chevron is our only close control. Remove Obsidian's built-in X
		// outright (.modal-close-button before 1.13, .modal-header-button after).
		this.modalEl.querySelector('.modal-close-button, .modal-header-button')?.remove();

		const { contentEl } = this;
		if (Platform.isMobile) contentEl.createDiv({ cls: 'audio-recorder-grabber' });

		const header = contentEl.createDiv({ cls: 'audio-recorder-modal-header' });
		const target = header.createDiv({ cls: 'audio-recorder-target' });
		target.createSpan({ cls: 'audio-recorder-target-label', text: 'Recording into' });
		this.noteEl = target.createSpan({ cls: 'audio-recorder-target-note' });

		const minimizeBtn = header.createEl('button', { cls: 'clickable-icon audio-recorder-minimize' });
		setIcon(minimizeBtn, 'chevron-down');
		setTooltip(minimizeBtn, 'Minimize', { placement: 'left' });
		minimizeBtn.addEventListener('click', () => this.close());

		const panel = contentEl.createDiv({ cls: 'audio-recorder-meter-panel' });
		this.meterEl = panel.createDiv({ cls: 'audio-recorder-meter' });

		this.timeEl = contentEl.createDiv({ cls: 'audio-recorder-modal-time', text: '00:00' });

		const controls = contentEl.createDiv({ cls: 'audio-recorder-controls' });
		const discardBtn = controls.createEl('button', { cls: 'audio-recorder-control' });
		setIcon(discardBtn, 'trash-2');
		setTooltip(discardBtn, 'Discard recording', { placement: 'top' });
		discardBtn.addEventListener('click', () => handlers.onDiscard());

		this.pauseBtn = controls.createEl('button', { cls: 'audio-recorder-control mod-primary' });
		this.pauseBtn.addEventListener('click', () => handlers.onPauseToggle());

		const stopBtn = controls.createEl('button', { cls: 'audio-recorder-control' });
		setIcon(stopBtn, 'square');
		setTooltip(stopBtn, 'Stop and save', { placement: 'top' });
		stopBtn.addEventListener('click', () => handlers.onStop());

		if (Platform.isMobile) this.enableSwipeToDismiss();
		this.setState('recording');
	}

	onOpen(): void {
		this.layoutMeter();
	}

	onClose(): void {
		this.modalEl.setCssProps({ '--sheet-offset': '0px' });
		this.handlers.onClose();
	}

	setTarget(name: string): void {
		this.noteEl.setText(name);
	}

	setState(state: RecorderState): void {
		const paused = state === 'paused';
		this.modalEl.toggleClass('is-paused', paused);
		setIcon(this.pauseBtn, paused ? 'play' : 'pause');
		setTooltip(this.pauseBtn, paused ? 'Resume' : 'Pause', { placement: 'top' });
		if (state === 'idle') {
			this.levels = [];
			this.renderMeter();
		}
	}

	setElapsed(ms: number): void {
		this.timeEl.setText(formatElapsed(ms));
	}

	/** Add the latest input level (0–1). The meter scrolls right to left. */
	pushLevel(level: number): void {
		this.levels.push(level);
		if (this.levels.length > this.bars.length) this.levels.splice(0, this.levels.length - this.bars.length);
		this.renderMeter();
	}

	/** Create as many bars as fit the panel's current width. */
	private layoutMeter(): void {
		const count = Math.max(1, Math.floor((this.meterEl.clientWidth + 4) / BAR_PITCH));
		if (count === this.bars.length) return;
		this.meterEl.empty();
		this.bars = Array.from({ length: count }, () => this.meterEl.createDiv({ cls: 'audio-recorder-bar' }));
		this.renderMeter();
	}

	private renderMeter(): void {
		const max = this.meterEl.clientHeight * 0.8;
		const offset = this.bars.length - this.levels.length;
		this.bars.forEach((bar, i) => {
			const level = this.levels[i - offset] ?? 0;
			bar.setCssProps({ '--bar-height': `${Math.max(MIN_BAR_HEIGHT, level * max)}px` });
		});
	}

	private enableSwipeToDismiss(): void {
		let startY: number | null = null;
		let dy = 0;
		this.modalEl.addEventListener('touchstart', (e) => {
			// Only start a drag from the top of the sheet, not from the controls.
			if ((e.target as HTMLElement).closest('.audio-recorder-controls')) return;
			startY = e.touches[0]?.clientY ?? null;
			dy = 0;
		});
		this.modalEl.addEventListener('touchmove', (e) => {
			if (startY === null) return;
			dy = Math.max(0, (e.touches[0]?.clientY ?? startY) - startY);
			this.modalEl.setCssProps({ '--sheet-offset': `${dy}px` });
		});
		this.modalEl.addEventListener('touchend', () => {
			if (startY === null) return;
			startY = null;
			if (dy > SWIPE_DISMISS_PX) this.close();
			else this.modalEl.setCssProps({ '--sheet-offset': '0px' });
		});
	}
}
