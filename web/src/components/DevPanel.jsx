import React, { useState } from 'react';
import { motion } from 'framer-motion';

import useNotifyStore from '../state/notifyStore';
import usePhoneStore from '../state/phoneStore';
import useDataStore from '../state/dataStore';
import { playSound } from '../utils/sound';

const SAMPLES = [
	{ label: 'Bank', payload: { app: 'bank', title: 'Maze Bank', content: 'Deposit of $12,500 received.', duration: 1000 } },
	{ label: 'Missed call', payload: { app: 'dialer', title: 'Sara Vance', content: 'Missed call · 555-0110', route: { tab: 'calls' }, duration: 1000 } },
	{ label: 'Job', payload: { app: 'hustlr', title: 'New gig nearby', content: 'Warehouse pickup · $850', duration: 1000 } },
	{ label: 'News', payload: { app: 'news', title: 'Weazel News', content: 'Shots fired downtown, avoid Vinewood Blvd.', duration: 1000 } },
	{ label: 'Sticky', payload: { app: 'underground', title: 'Anonymous', content: 'Stays until dismissed.', duration: 0 } },
	{ label: 'Silent', payload: { app: 'weather', title: 'Weather', content: 'Rain moving in.', sound: false } },
];

const INVOICES = [
	{ label: 'Speeding fine', sender: 'LSPD', amount: 750 },
	{ label: 'Vehicle repair', sender: 'Bennys', amount: 1_450 },
	{ label: 'Garage storage', sender: 'Bennys', amount: 240 },
	{ label: 'Hospital bill', sender: 'Pillbox Medical', amount: 3_200 },
];

const PEOPLE = [
	{ name: 'Mikkel', number: '555-0192', content: 'meet me behind the pier in 5, bring the van' },
	{ name: 'Sara Vance', number: '555-0110', content: 'the car is ready whenever you are' },
	{ name: 'Chop Shop', number: '555-0777', content: 'got a buyer for the Sultan. 20k, tonight only' },
	{ name: 'Unknown', number: '555-0451', content: 'wrong number?' },
];

export default function DevPanel() {
	const [collapsed, setCollapsed] = useState(false);

	const add = useNotifyStore((s) => s.add);
	const { open, expanded, setOpen, toggleExpanded, resetLayout } = usePhoneStore();
	const pushMessage = useDataStore((s) => s.pushMessage);
	const number = useDataStore((s) => s.number);

	const burst = () => {
		SAMPLES.slice(0, 4).forEach((sample, index) => {
			setTimeout(() => add({ ...sample.payload, duration: 1000 }), index * 260);
		});
	};

	const incomingText = (person) => {
		pushMessage({
			id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			sender: person.number,
			receiver: number,
			content: person.content,
			read: 0,
			createdAt: Date.now(),
		});

		add({ app: 'messages', title: person.name, content: person.content, route: { number: person.number } });
	};

	const testInvoice = (canDecline = true) => {
		const state = useDataStore.getState();
		const invoices = state.invoices ?? [];

		const id = invoices.reduce((max, entry) => Math.max(max, entry.id ?? 0), 0) + 1;
		const sample = INVOICES[Math.floor(Math.random() * INVOICES.length)];

		state.setData({
			invoices: [
				{ id, label: sample.label, sender: sample.sender, amount: sample.amount, paid: 0, createdAt: Date.now() },
				...invoices,
			],
		});

		add({
			app: 'bank',
			title: `Invoice #${String(id).padStart(4, '0')}`,
			content: `${sample.label} · $${sample.amount} from ${sample.sender}`,
			duration: 0,
			sound: true,
			route: { tab: 'invoices' },
			offer: { kind: 'invoice', invoice: id, acceptLabel: 'Pay', canDecline },
		});

		useDataStore.setState({
			invoices: useDataStore
				.getState()
				.invoices.map((entry) => (entry.id === id ? { ...entry, canDecline: canDecline ? 1 : 0 } : entry)),
		});
	};

	const textStorm = () => {
		PEOPLE.forEach((person, index) => {
			setTimeout(() => incomingText(person), index * 700);
		});
	};

	return (
		<motion.div
			initial={false}
			animate={{ x: collapsed ? -228 : 0 }}
			transition={{ type: 'spring', stiffness: 320, damping: 34 }}
			className="pointer-events-auto fixed left-4 top-4 z-[90] w-[252px] rounded-2xl border border-white/10 bg-zinc-900/95 p-3 text-white shadow-2xl backdrop-blur"
		>
			<div className="mb-2 flex items-center justify-between">
				<span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Dev</span>
				<button
					onClick={() => setCollapsed((v) => !v)}
					className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/60"
				>
					{collapsed ? '»' : '«'}
				</button>
			</div>

			<div className="mb-2 grid grid-cols-2 gap-1.5">
				<button
					onClick={() => setOpen(!open)}
					className="rounded-lg bg-white/10 py-1.5 text-[12px] font-medium hover:bg-white/20"
				>
					{open ? 'Close phone' : 'Open phone'}
				</button>
				<button
					onClick={toggleExpanded}
					className="rounded-lg bg-white/10 py-1.5 text-[12px] font-medium hover:bg-white/20"
				>
					{expanded ? 'Fold' : 'Flip out'}
				</button>
			</div>

			<div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
				Notifications
			</div>

			<div className="mb-2 grid grid-cols-2 gap-1.5">
				{SAMPLES.map((sample) => (
					<button
						key={sample.label}
						onClick={() => add(sample.payload)}
						className="rounded-lg bg-sky-500/15 py-1.5 text-[12px] font-medium text-sky-300 hover:bg-sky-500/25"
					>
						{sample.label}
					</button>
				))}
			</div>

			<div className="mb-2 grid grid-cols-2 gap-1.5">
				<button
					onClick={() => testInvoice(true)}
					title="Pay or Decline — declining leaves it unpaid in the Invoices tab"
					className="rounded-lg bg-teal-500/15 py-1.5 text-[12px] font-medium text-teal-300 hover:bg-teal-500/25"
				>
					Invoice
				</button>
				<button
					onClick={() => testInvoice(false)}
					title="canDecline = false — Pay is the only way out"
					className="rounded-lg bg-teal-500/15 py-1.5 text-[12px] font-medium text-teal-300 hover:bg-teal-500/25"
				>
					Invoice · locked
				</button>
			</div>

			<div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
				Incoming texts
			</div>

			<div className="mb-2 grid grid-cols-2 gap-1.5">
				{PEOPLE.map((person) => (
					<button
						key={person.number}
						onClick={() => incomingText(person)}
						title={person.content}
						className="truncate rounded-lg bg-violet-500/15 px-2 py-1.5 text-[12px] font-medium text-violet-300 hover:bg-violet-500/25"
					>
						{person.name}
					</button>
				))}
			</div>

			<div className="grid grid-cols-2 gap-1.5">
				<button
					onClick={burst}
					className="rounded-lg bg-emerald-500/15 py-1.5 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/25"
				>
					Burst ×4
				</button>
				<button
					onClick={textStorm}
					className="rounded-lg bg-violet-500/15 py-1.5 text-[12px] font-medium text-violet-300 hover:bg-violet-500/25"
				>
					Text storm
				</button>
				<button
					onClick={() => {
						const phoneOpen = usePhoneStore.getState().open;

						usePhoneStore.getState().setCall({
							number: '555-0110',
							name: 'Sara Vance',
							direction: 'in',
							state: 'incoming',
							minimized: !phoneOpen,
							expanded: !phoneOpen,
						});
						playSound('newnotification');
					}}
					className="rounded-lg bg-amber-500/15 py-1.5 text-[12px] font-medium text-amber-300 hover:bg-amber-500/25"
				>
					Incoming call
				</button>
				<button
					onClick={resetLayout}
					className="rounded-lg bg-rose-500/15 py-1.5 text-[12px] font-medium text-rose-300 hover:bg-rose-500/25"
				>
					Reset grid
				</button>
			</div>
		</motion.div>
	);
}
