import React from 'react';
import { motion } from 'framer-motion';

import usePhoneStore from '../state/phoneStore';

export default function BottomBar() {
	const back = usePhoneStore((s) => s.back);
	const activeApp = usePhoneStore((s) => s.activeApp);
	const editMode = usePhoneStore((s) => s.editMode);
	const notificationCentre = usePhoneStore((s) => s.notificationCentre);

	const layered = Boolean(activeApp || editMode || notificationCentre);

	return (
		<div
			className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-center"
			style={{ height: 'var(--chrome-b)' }}
		>
			<motion.button
				onClick={back}
				whileTap={{ scaleX: 0.86 }}
				title={layered ? 'Close app' : 'Close phone (Esc)'}
				className="rounded-full bg-white/85 transition hover:bg-white"
				style={{
					width: 'var(--indicator-w)',
					height: 'calc(var(--pw) * 0.013)',
				}}
			/>
		</div>
	);
}
