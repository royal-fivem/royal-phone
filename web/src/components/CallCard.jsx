import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Call02Icon, CallEnd01Icon, Message01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

import usePhoneStore from '../state/phoneStore';
import fetchNui from '../utils/fetchNui';
import useCallTimer, { formatDuration } from '../utils/useCallTimer';

function RoundButton({ icon, onClick, className = '', size = 0.085 }) {
	return (
		<motion.button
			whileTap={{ scale: 0.88 }}
			onClick={onClick}
			className={`grid shrink-0 place-items-center rounded-full transition ${className}`}
			style={{ width: `calc(var(--pw) * ${size})`, height: `calc(var(--pw) * ${size})` }}
		>
			<HugeiconsIcon icon={icon} size={16} strokeWidth={2.2} className="h-1/2 w-1/2" />
		</motion.button>
	);
}

export default function CallCard() {
	const call = usePhoneStore((s) => s.call);
	const open = usePhoneStore((s) => s.open);
	const setCall = usePhoneStore((s) => s.setCall);
	const answerCall = usePhoneStore((s) => s.answerCall);
	const declineCall = usePhoneStore((s) => s.declineCall);
	const collapse = usePhoneStore((s) => s.collapseCallCard);
	const openFromCallMode = usePhoneStore((s) => s.openFromCallMode);
	const openApp = usePhoneStore((s) => s.openApp);

	const seconds = useCallTimer(call?.connectedAt);
	const ringing = call?.state === 'incoming';
	const showing = Boolean(call?.expanded) && !open;

	const hangUp = () => {
		fetchNui('endCall');
		setCall(null);
	};

	const text = () => {
		openFromCallMode();
		openApp('messages', { number: call.number });
	};

	return (
		<div
			className="pointer-events-none absolute inset-x-0 z-[72] flex justify-center"
			style={{ top: 'calc(var(--status-h) * 0.84)' }}
		>
		<AnimatePresence>
			{showing && (
				<motion.div
					initial={{ y: -60, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: -60, opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
					transition={{ type: 'spring', stiffness: 460, damping: 38, mass: 0.7 }}
					className="pointer-events-auto w-[min(90%,calc(var(--pw)*0.9))]"
				>
					<div
						className="border border-white/[0.07] bg-[#0d0d0f]/95 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.9)]"
						style={{
							borderRadius: 'calc(var(--pw) * 0.04)',
							padding: 'calc(var(--pw) * 0.028)',
						}}
					>
						<div className="flex items-center" style={{ gap: 'calc(var(--pw) * 0.034)' }}>
							<motion.div
								animate={ringing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
								transition={ringing ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
								className="grid shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
								style={{ width: 'calc(var(--pw) * 0.101)', height: 'calc(var(--pw) * 0.101)' }}
							>
								<HugeiconsIcon icon={Call02Icon} size={18} strokeWidth={2.1} className="h-1/2 w-1/2" />
							</motion.div>

							<div className="min-w-0 flex-1">
								<div
									className="truncate font-bold leading-tight text-white"
									style={{ fontSize: 'calc(var(--pw) * 0.038)' }}
								>
									{call.name}
								</div>
								<div
									className="tabular-nums text-emerald-400"
									style={{ fontSize: 'calc(var(--pw) * 0.033)', marginTop: 'calc(var(--pw) * 0.006)' }}
								>
									{ringing
										? 'Incoming call'
										: call.state === 'active'
											? formatDuration(seconds)
											: call.direction === 'out'
												? 'Ringing…'
												: 'Connecting…'}
								</div>

								{ringing && (call.answerKey || call.declineKey) && (
									<div
										className="flex items-center text-white/40"
										style={{
											fontSize: 'calc(var(--pw) * 0.029)',
											gap: 'calc(var(--pw) * 0.02)',
											marginTop: 'calc(var(--pw) * 0.008)',
										}}
									>
										{call.answerKey && <span>[{call.answerKey}] answer</span>}
										{call.declineKey && <span>[{call.declineKey}] decline</span>}
									</div>
								)}
							</div>

							{ringing ? (
								<div className="flex shrink-0 items-center" style={{ gap: 'calc(var(--pw) * 0.022)' }}>
									<RoundButton
										icon={Call02Icon}
										onClick={answerCall}
										size={0.105}
										className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
									/>
									<RoundButton
										icon={CallEnd01Icon}
										onClick={declineCall}
										size={0.105}
										className="bg-rose-600 text-white shadow-lg shadow-rose-600/30"
									/>
								</div>
							) : (
								<div className="flex shrink-0 items-center" style={{ gap: 'calc(var(--pw) * 0.018)' }}>
									<RoundButton icon={Message01Icon} onClick={text} className="bg-white/[0.10] text-white" />
									<RoundButton icon={CallEnd01Icon} onClick={hangUp} className="bg-rose-600 text-white" />
									<RoundButton
										icon={Cancel01Icon}
										onClick={collapse}
										className="bg-transparent text-white/35 hover:bg-white/10 hover:text-white/80"
									/>
								</div>
							)}
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
		</div>
	);
}
