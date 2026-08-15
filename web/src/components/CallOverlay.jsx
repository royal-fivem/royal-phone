import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';

import ScreenScale from './ScreenScale';
import CallScreen from './CallScreen';
import usePhoneStore from '../state/phoneStore';
import fetchNui from '../utils/fetchNui';

export default function CallOverlay({ panelWidth }) {
	const call = usePhoneStore((s) => s.call);
	const setCall = usePhoneStore((s) => s.setCall);
	const answerCall = usePhoneStore((s) => s.answerCall);
	const declineCall = usePhoneStore((s) => s.declineCall);
	const minimizeCall = usePhoneStore((s) => s.minimizeCall);

	const foreground = call && !call.minimized;

	const hangUp = () => {
		if (call?.state === 'incoming') return declineCall();

		fetchNui('endCall');
		setCall(null);
	};

	return (
		<AnimatePresence>
			{foreground && (
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 24 }}
					transition={{ type: 'spring', stiffness: 380, damping: 36 }}
					className="absolute inset-0 z-[28] bg-gradient-to-b from-zinc-900 to-black"
				>
					<ScreenScale
						panelWidth={panelWidth}
						className="flex flex-col"
						style={{
							paddingTop: 'calc(var(--status-h) + 8px)',
							paddingBottom: 'calc(var(--chrome-b) + 12px)',
						}}
					>
						<button
							onClick={minimizeCall}
							title="Keep the call and use the phone"
							className="ml-5 mt-1 w-fit rounded-full bg-white/[0.08] p-2 text-white/60 transition hover:bg-white/15 hover:text-white"
						>
							<HugeiconsIcon icon={ArrowDown01Icon} size={18} strokeWidth={2.2} />
						</button>

						<CallScreen call={call} onEnd={hangUp} onAnswer={answerCall} />
					</ScreenScale>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
