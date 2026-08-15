import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { getApp } from '../config/apps';
import StubApp from '../apps/StubApp';
import ScreenScale from './ScreenScale';
import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';
import { clamp } from '../utils/format';

const OPEN = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };
const CLOSE = { duration: 0.19, ease: [0.4, 0, 1, 1] };
const SEED = 0.18;

export default function AppHost({ panelWidth }) {
	const activeApp = usePhoneStore((s) => s.activeApp);
	const appProps = usePhoneStore((s) => s.appProps);
	const launchOrigin = usePhoneStore((s) => s.launchOrigin);
	const markAppRead = useNotifyStore((s) => s.markAppRead);

	const ref = useRef(null);
	const [origin, setOrigin] = useState('50% 50%');

	useEffect(() => {
		if (activeApp) markAppRead(activeApp);
	}, [activeApp, markAppRead]);

	useLayoutEffect(() => {
		if (!activeApp) return;

		if (!launchOrigin) {
			setOrigin('50% 50%');
			return;
		}

		const rect = ref.current?.parentElement?.getBoundingClientRect();
		if (!rect?.width || !rect?.height) return;

		const x = clamp(((launchOrigin.x - rect.left) / rect.width) * 100, 0, 100);
		const y = clamp(((launchOrigin.y - rect.top) / rect.height) * 100, 0, 100);

		setOrigin(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
	}, [activeApp, launchOrigin]);

	const app = activeApp ? getApp(activeApp) : null;
	const Component = app?.component ?? StubApp;

	return (
		<AnimatePresence>
			{app && (
				<motion.div
					key={app.id}
					ref={ref}
					className={`absolute inset-0 z-20 overflow-hidden ${app.background ?? 'bg-black'}`}
					style={{ transformOrigin: origin }}
					initial={{ opacity: 0, scale: SEED }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: SEED, transition: CLOSE }}
					transition={OPEN}
				>
					<ScreenScale panelWidth={panelWidth}>
						<Component app={app} initial={appProps} />
					</ScreenScale>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
