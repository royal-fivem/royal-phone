import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import PhoneShell from './components/PhoneShell';
import NuiBridge from './components/NuiBridge';
import DevPanel from './components/DevPanel';

import usePhoneStore from './state/phoneStore';
import useDataStore from './state/dataStore';
import useNotifyStore from './state/notifyStore';
import useLifeinvaderStore from './state/lifeinvaderStore';
import useFishingStore from './state/fishingStore';
import useDocumentsStore from './state/documentsStore';
import isEnvBrowser from './utils/isEnvBrowser';
import { APP_IDS } from './config/apps';

// @ts-ignore
import './style.css';

export function App() {
	const browser = isEnvBrowser();

	useEffect(() => {
		if (!browser) return;

		// Stand-in for the game: a backdrop plus a populated phone to poke at.
		const root = document.getElementById('app');
		if (root) root.style.background = 'radial-gradient(120% 120% at 30% 20%, #1b2230 0%, #0b0d12 60%, #050608 100%)';

		useDataStore.getState().loadMock();
		useLifeinvaderStore.getState().loadMock();
		useFishingStore.getState().loadMock();
		useDocumentsStore.getState().loadMock();
		usePhoneStore.getState().syncLayout(APP_IDS);
		usePhoneStore.getState().setOpen(true);

		// Handy from the console while developing; never exposed in game.
		window.royalPhone = { phone: usePhoneStore, data: useDataStore, notify: useNotifyStore, li: useLifeinvaderStore, fish: useFishingStore, docs: useDocumentsStore };
	}, [browser]);

	return (
		<NuiBridge>
			{/* A toast arriving while the phone is pocketed makes the phone itself
			    peek up from the bottom edge — see PhoneShell. */}
			<PhoneShell />

			{browser && <DevPanel />}
		</NuiBridge>
	);
}

const rootElement = document.getElementById('app');
if (rootElement) {
	ReactDOM.createRoot(rootElement).render(<App />);
}
