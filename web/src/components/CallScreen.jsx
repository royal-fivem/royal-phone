import React from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Call02Icon,
	CallEnd01Icon,
	Mic02Icon,
	MicOff02Icon,
	UserIcon,
} from '@hugeicons/core-free-icons';

import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import useCallTimer, { formatDuration } from '../utils/useCallTimer';

/**
 * The call UI. Shared by the Phone app — where it takes over the body and
 * leaves the tab bar in place — and the global overlay used by calls started
 * anywhere else, so both look the same.
 *
 * Only mute is offered. Speaker and video were buttons that lit up and did
 * nothing — there is no second audio route to switch to and no video stream to
 * send, so they were decoration pretending to be controls.
 */
export default function CallScreen({ call, onEnd, onAnswer }) {
	const muted = usePhoneStore((s) => s.callMuted);
	const toggleMute = usePhoneStore((s) => s.toggleMute);

	const seconds = useCallTimer(call.connectedAt);
	const contactFor = useDataStore((s) => s.contactFor);

	const avatar = contactFor(call.number)?.avatar;
	const ringing = call.state !== 'active';

	const status = call.state === 'active'
		? formatDuration(seconds)
		: call.direction === 'in'
			? 'Incoming call'
			: 'Ringing...';

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-between px-6 pb-2 pt-6">
			<div className="flex flex-1 flex-col items-center justify-center gap-5">
				<motion.div
					animate={ringing ? { scale: [1, 1.03, 1] } : { scale: 1 }}
					transition={ringing ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
					className="grid h-[150px] w-[150px] place-items-center overflow-hidden rounded-[34%] border-2 border-white/25"
				>
					{avatar ? (
						<img src={avatar} alt="" className="h-full w-full object-cover" />
					) : (
						<HugeiconsIcon icon={UserIcon} size={54} strokeWidth={1.2} className="text-white/20" />
					)}
				</motion.div>

				<div className="text-center">
					<div className="text-[26px] font-bold tracking-tight text-white">{call.name}</div>
					<div className="mt-1 text-[14px] tabular-nums text-white/45">{status}</div>
				</div>
			</div>

			<div className="mb-3 flex items-start justify-center gap-5">
				{/* Only live once connected — muting a phone that is still ringing
				    would silently persist into the call. */}
				{call.state === 'active' && (
					<button onClick={toggleMute} className="flex flex-col items-center gap-1.5">
						<span
							className={`grid h-[52px] w-[52px] place-items-center rounded-full transition ${
								muted ? 'bg-white text-black' : 'bg-white/[0.09] text-white'
							}`}
						>
							<HugeiconsIcon icon={muted ? MicOff02Icon : Mic02Icon} size={21} strokeWidth={1.9} />
						</span>
						<span className="text-[11px] text-white/50">{muted ? 'Muted' : 'Mute'}</span>
					</button>
				)}

				{/* An unanswered incoming call gets a pick-up button beside End. */}
				{onAnswer && call.state === 'incoming' && (
					<button onClick={onAnswer} className="flex flex-col items-center gap-1.5">
						<span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40">
							<HugeiconsIcon icon={Call02Icon} size={21} strokeWidth={2} />
						</span>
						<span className="text-[11px] text-white/50">Answer</span>
					</button>
				)}

				<button onClick={onEnd} className="flex flex-col items-center gap-1.5">
					<span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40">
						<HugeiconsIcon icon={CallEnd01Icon} size={21} strokeWidth={2} />
					</span>
					<span className="text-[11px] text-white/50">{call.state === 'incoming' ? 'Decline' : 'End'}</span>
				</button>
			</div>
		</div>
	);
}
