import React, { useEffect, useRef, useState } from 'react';

import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';
import useDataStore from '../state/dataStore';
import fetchNui from '../utils/fetchNui';
import useNuiEvent from '../utils/useNuiEvent';

export default function CustomApp({ app }) {
	const frame = useRef(null);
	const [loaded, setLoaded] = useState(false);

	const closeApp = usePhoneStore((s) => s.closeApp);
	const back = usePhoneStore((s) => s.back);
	const notify = useNotifyStore((s) => s.add);

	useEffect(() => {
		setLoaded(false);
	}, [app.id, app.ui]);

	useNuiEvent('customAppMessage', (payload) => {
		if (!payload || payload.id !== app.id) return;
		frame.current?.contentWindow?.postMessage({ type: payload.type, data: payload.data }, '*');
	});

	useEffect(() => {
		/** @param {any} payload */
		const post = (payload) => frame.current?.contentWindow?.postMessage(payload, '*');

		const handle = (message) => {
			if (message.source !== frame.current?.contentWindow) return;

			const { type, data } = message.data ?? {};

			switch (type) {
				case 'ready':
					{
						const { number, name, job } = useDataStore.getState();

						post({
							type: 'init',
							data: { appId: app.id, number, name, job, settings: usePhoneStore.getState().settings },
						});
					}
					break;

				case 'close':
					closeApp();
					break;

				case 'back':
					back();
					break;

				case 'typing':
					fetchNui('typing', { active: data?.active === true });
					break;

				case 'notify':
					notify({ ...(data ?? {}), app: app.id });
					break;

				default:
					break;
			}
		};

		window.addEventListener('message', handle);
		return () => window.removeEventListener('message', handle);
	}, [app.id, closeApp, back, notify]);

	useEffect(() => () => fetchNui('typing', { active: false }), []);

	return (
		<div className="relative h-full w-full overflow-hidden">
			{!loaded && (
				<div className="absolute inset-0 grid place-items-center bg-black">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
				</div>
			)}

			<iframe
				ref={frame}
				src={app.ui}
				title={app.label}
				onLoad={() => setLoaded(true)}
				allow="autoplay; microphone"
				className="h-full w-full border-0 bg-transparent"
			/>
		</div>
	);
}
