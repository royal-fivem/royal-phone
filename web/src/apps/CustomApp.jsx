import React, { useEffect, useRef, useState } from 'react';

import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';
import useDataStore from '../state/dataStore';
import fetchNui from '../utils/fetchNui';
import useNuiEvent from '../utils/useNuiEvent';

/**
 * Hosts a resource's own page in an iframe and speaks the postMessage protocol
 * that template/royal-phone-app/ui/royal-phone.js wraps. Messages from the page:
 *
 *   ready              -> phone answers with `init`
 *   close / back       -> leave the app / go back
 *   typing { active }  -> hand the keyboard to the page while a field has focus
 *   notify { ... }     -> a phone notification under this app's icon
 *   openApp { app, route }
 *
 * Messages to the page: `init`, `route` (opened again from a notification),
 * and anything sent with the SendAppMessage exports.
 */
export default function CustomApp({ app, initial }) {
	const frame = useRef(null);
	const [loaded, setLoaded] = useState(false);
	const ready = useRef(false);

	const closeApp = usePhoneStore((s) => s.closeApp);
	const back = usePhoneStore((s) => s.back);
	const openApp = usePhoneStore((s) => s.openApp);
	const notify = useNotifyStore((s) => s.add);

	const post = (payload) => frame.current?.contentWindow?.postMessage(payload, '*');

	useEffect(() => {
		setLoaded(false);
		ready.current = false;
	}, [app.id, app.ui]);

	// Tapping one of this app's notifications while it is already open.
	useEffect(() => {
		if (ready.current && initial != null) post({ type: 'route', data: initial });
	}, [initial]);

	useNuiEvent('customAppMessage', (payload) => {
		if (!payload || payload.id !== app.id) return;
		post({ type: payload.type, data: payload.data });
	});

	useEffect(() => {
		const insets = () => {
			const style = frame.current ? getComputedStyle(frame.current) : null;

			return {
				top: style?.getPropertyValue('--status-h').trim() || '0px',
				bottom: style?.getPropertyValue('--chrome-b').trim() || '0px',
			};
		};

		const handle = (message) => {
			if (!frame.current || message.source !== frame.current.contentWindow) return;

			const { type, data } = message.data ?? {};

			switch (type) {
				case 'ready': {
					const { number, name, job } = useDataStore.getState();
					ready.current = true;

					post({
						type: 'init',
						data: {
							appId: app.id,
							resource: app.resource,
							number,
							name,
							job,
							route: initial ?? null,
							insets: insets(),
							settings: usePhoneStore.getState().settings,
						},
					});
					break;
				}

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
					if (usePhoneStore.getState().settings.dnd) break;
					notify({ ...(data ?? {}), app: app.id });
					break;

				case 'openApp':
					if (typeof data?.app === 'string') openApp(data.app, data.route ?? null);
					break;

				default:
					break;
			}
		};

		window.addEventListener('message', handle);
		return () => window.removeEventListener('message', handle);
	}, [app.id, app.resource, closeApp, back, openApp, notify, initial]);

	useEffect(() => () => fetchNui('typing', { active: false }), []);

	return (
		<div className="relative h-full w-full overflow-hidden" style={{ background: app.backgroundStyle }}>
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
