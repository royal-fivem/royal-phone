import React, { Suspense, useEffect } from 'react';

import { getApp } from '../config/apps';
import StubApp from '../apps/StubApp';
import ScreenScale from './ScreenScale';
import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';

/**
 * Mounts the active app over the home screen. Only one app is ever mounted, so
 * an app that keeps timers or subscriptions is torn down the moment it closes.
 *
 * Switching is deliberately instant — no transition — and the layer is full
 * bleed and opaque, so an app's background runs edge to edge with the status
 * bar and home indicator drawn on top of it.
 */
export default function AppHost({ panelWidth }) {
	const activeApp = usePhoneStore((s) => s.activeApp);
	const appProps = usePhoneStore((s) => s.appProps);
	const markAppRead = useNotifyStore((s) => s.markAppRead);

	// Opening an app is acknowledgement enough — its bubble goes out.
	useEffect(() => {
		if (activeApp) markAppRead(activeApp);
	}, [activeApp, markAppRead]);

	const app = activeApp ? getApp(activeApp) : null;
	if (!app) return null;

	const Component = app.component ?? StubApp;

	return (
		<div className={`absolute inset-0 z-20 overflow-hidden ${app.background ?? 'bg-black'}`}>
			<ScreenScale panelWidth={panelWidth}>
				<Suspense fallback={null}>
					<Component app={app} initial={appProps} />
				</Suspense>
			</ScreenScale>
		</div>
	);
}
