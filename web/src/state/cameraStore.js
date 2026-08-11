import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';

const STEP = 0.08;
const FLASH_DELAY = 120;
const MOCK_SHOT =
	'data:image/svg+xml;base64,' +
	btoa(
		'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
		'<rect width="320" height="180" fill="#1e293b"/></svg>'
	);

const clamp = (value) => Math.min(1, Math.max(0, value));

const useCameraStore = create((set, get) => ({
	active: false,
	front: false,
	zoom: 0,
	flashOn: false,
	cursor: false,
	capturing: false,
	flash: false,
	hud: true,
	last: null,

	open: () => {
		const flashOn = get().flashOn;

		set({ active: true, front: false, zoom: 0, cursor: false, flash: false, hud: true });
		fetchNui('camera:start', { front: false, zoom: 0, flash: flashOn });
	},

	close: () => {
		if (!get().active) return;

		set({ active: false, capturing: false, flash: false, cursor: false, hud: true });
		fetchNui('camera:stop');
	},

	sync: (data) => {
		if (!data) return;

		set({
			front: Boolean(data.front),
			zoom: clamp(Number(data.zoom) || 0),
			flashOn: Boolean(data.flash),
			cursor: Boolean(data.cursor),
		});
	},

	flip: () => {
		const front = !get().front;

		set({ front });
		fetchNui('camera:set', { front });
	},

	toggleFlash: () => {
		const flashOn = !get().flashOn;

		set({ flashOn });
		fetchNui('camera:set', { flash: flashOn });
	},

	toggleCursor: () => {
		const cursor = !get().cursor;

		set({ cursor });
		fetchNui('camera:cursor', { cursor });
	},

	zoomBy: (delta) => {
		const zoom = clamp(get().zoom + delta * STEP);
		if (zoom === get().zoom) return;

		set({ zoom });
		fetchNui('camera:set', { zoom });
	},

	capture: async () => {
		if (get().capturing) return null;

		set({ capturing: true, flash: true });
		setTimeout(() => set({ flash: false }), 160);

		await fetchNui('camera:flash', {}, true);
		await new Promise((resolve) => setTimeout(resolve, FLASH_DELAY));

		const { captureGameImage } = await import('../components/GameView');

		const data = (await captureGameImage()) ?? MOCK_SHOT;

		const result = await fetchNui('camera:save', { data }, {
			ok: true,
			photo: { id: Date.now(), takenAt: Date.now(), url: data },
		});

		const photo = result?.ok ? result.photo : null;

		set({ capturing: false, last: photo?.url ?? get().last });

		return photo;
	},
}));

export default useCameraStore;
