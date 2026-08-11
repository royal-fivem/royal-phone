import usePhoneStore from '../state/phoneStore';

/**
 * Bundled UI sounds. Globbed rather than imported one by one so dropping an
 * `.mp3` into `src/sounds/` makes it playable by filename, and only files that
 * exist end up in the build.
 */
const files = import.meta.glob('../sounds/*.mp3', {
	eager: true,
	query: '?url',
	import: 'default',
});

const SOURCES = Object.fromEntries(
	Object.entries(files).map(([path, url]) => [
		path.split('/').pop().replace(/\.mp3$/i, '').toLowerCase(),
		url,
	])
);

/**
 * One reusable Audio element per sound. Creating them lazily on first play
 * avoids decoding every clip at boot, and reusing them means a burst of
 * notifications does not leak elements.
 */
const players = new Map();

const playerFor = (name) => {
	const key = name.toLowerCase();

	if (!players.has(key)) {
		const src = SOURCES[key];
		if (!src) return null;

		const audio = new Audio(src);
		audio.preload = 'auto';
		players.set(key, audio);
	}

	return players.get(key);
};

/**
 * Play a bundled sound, honouring the phone's sound settings.
 *
 * @param {string} name filename without extension, e.g. 'newnotification'
 * @param {{ force?: boolean }} [options] force ignores the mute toggle — used
 *   by the settings screen so the volume slider can be previewed while muted.
 */
export function playSound(name, options = {}) {
	const { sounds, volume } = usePhoneStore.getState().settings;
	if (!sounds && !options.force) return;

	const audio = playerFor(name);
	if (!audio) return;

	audio.volume = Math.min(1, Math.max(0, (volume ?? 70) / 100));
	audio.currentTime = 0;

	// Autoplay can be refused before the page has been interacted with; a
	// missing blip is not worth an unhandled rejection.
	audio.play().catch(() => {});
}

/**
 * Start a sound looping — the ringtone, and anything else that should run until
 * something stops it rather than for a fixed length.
 *
 * Safe to call twice: an already-looping sound is left alone rather than
 * restarted, so a second `incomingCall` for the same call does not snap the
 * ringtone back to the beginning.
 *
 * @param {string} name filename without extension, e.g. 'ringtone'
 */
export function startLoop(name) {
	const { sounds, volume } = usePhoneStore.getState().settings;
	if (!sounds) return;

	const audio = playerFor(name);
	if (!audio) return;

	audio.volume = Math.min(1, Math.max(0, (volume ?? 70) / 100));
	audio.loop = true;

	if (!audio.paused) return;

	audio.currentTime = 0;
	audio.play().catch(() => {});
}

/**
 * Stop a looping sound and rewind it, so the next call starts from the top.
 * A no-op for a sound that was never started.
 *
 * @param {string} name
 */
export function stopLoop(name) {
	const audio = players.get(name.toLowerCase());
	if (!audio) return;

	audio.pause();
	audio.loop = false;
	audio.currentTime = 0;
}

export const SOUND_NAMES = Object.keys(SOURCES);
