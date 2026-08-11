import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';

/**
 * The camera.
 *
 * Opening the Camera app hands the screen over: the phone slides away and a
 * full-screen viewfinder takes over, because the photo *is* the game view. A
 * viewfinder painted inside the phone would be a picture of a picture — you
 * would be looking at a rectangle that shows the world, held inside a rectangle
 * that hides it.
 *
 * Lua owns the scripted camera; this store is the UI's copy of where it is
 * pointed, so the HUD can render without asking.
 */

/** Zoom runs 0 (wide) to 1 (tight). Lua maps it onto a field of view. */
const STEP = 0.08;

const clamp = (value) => Math.min(1, Math.max(0, value));

const useCameraStore = create((set, get) => ({
	/** True while the viewfinder owns the screen. */
	active: false,
	/** Selfie mode. */
	front: false,
	zoom: 0,
	/** Set while a shot is being taken, so the shutter cannot double-fire. */
	capturing: false,
	/** Briefly true after a capture, to flash the screen white. */
	flash: false,
	/**
	 * The viewfinder's own chrome. Lua drops this for the frame it captures —
	 * without it the brackets, the zoom rail and the shutter end up in the photo.
	 */
	hud: true,
	/** Last shot, shown as a thumbnail in the corner. */
	last: null,

	open: () => {
		set({ active: true, front: false, zoom: 0, flash: false, hud: true });
		fetchNui('camera:start', { front: false, zoom: 0 });
	},

	close: () => {
		if (!get().active) return;

		// `hud` is reset too: a capture that failed mid-flight would otherwise
		// leave the viewfinder invisible the next time it opens.
		set({ active: false, capturing: false, flash: false, hud: true });
		fetchNui('camera:stop');
	},

	flip: () => {
		const front = !get().front;

		set({ front });
		fetchNui('camera:set', { front, zoom: get().zoom });
	},

	/** @param {number} delta positive zooms in */
	zoomBy: (delta) => {
		const zoom = clamp(get().zoom + delta * STEP);
		if (zoom === get().zoom) return;

		set({ zoom });
		fetchNui('camera:set', { front: get().front, zoom });
	},

	/**
	 * Take the shot.
	 *
	 * Lua hides the HUD, captures, and hands back a URL — the flash is fired
	 * here rather than there so it lands the instant the shutter is pressed
	 * instead of after the round trip.
	 */
	capture: async () => {
		if (get().capturing) return null;

		set({ capturing: true, flash: true });
		setTimeout(() => set({ flash: false }), 160);

		const result = await fetchNui('camera:capture', {}, {
			ok: true,
			url: 'data:image/svg+xml;base64,' + btoa(
				'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
				'<rect width="320" height="180" fill="#1e293b"/></svg>'
			),
		});

		set({ capturing: false, last: result?.url ?? get().last });

		return result?.url ?? null;
	},
}));

export default useCameraStore;
