import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Clock01Icon,
	DialpadCircle01Icon,
	Message01Icon,
	Contact01Icon,
	Search01Icon,
	Shield01Icon,
	UserAdd01Icon,
	UserIcon,
	Call02Icon,
	CallEnd01Icon,
	CallIncoming01Icon,
	CallOutgoing01Icon,
	CallMissed01Icon,
	Delete02Icon,
	PencilEdit01Icon,
	Share01Icon,
	VolumeHighIcon,
	Mic02Icon,
	Cancel01Icon,
} from '@hugeicons/core-free-icons';

import { Avatar, isPhotoRef, photoRef } from './_shared';
import CallScreen from '../components/CallScreen';
import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import fetchNui from '../utils/fetchNui';
import { formatRelative } from '../utils/format';
import useCallTimer, { formatDuration } from '../utils/useCallTimer';

function Header({ title, actions }) {
	return (
		<header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
			<h1 className="flex-1 truncate text-[26px] font-bold leading-tight tracking-tight text-white">
				{title}
			</h1>
			{actions}
		</header>
	);
}

function IconButton({ icon, onClick, className = 'text-white/70' }) {
	return (
		<button
			onClick={onClick}
			className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 hover:text-white ${className}`}
		>
			<HugeiconsIcon icon={icon} size={18} strokeWidth={1.9} />
		</button>
	);
}

function SearchField({ value, onChange, placeholder = 'Search' }) {
	return (
		<div className="mb-4 flex items-center gap-2 rounded-2xl bg-white/[0.07] px-4 py-3">
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
			/>
			<HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={2} className="shrink-0 text-white/45" />
		</div>
	);
}

function Empty({ icon, label }) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
			<HugeiconsIcon icon={icon} size={34} strokeWidth={1.4} className="text-white/30" />
			<span className="text-[14px] font-medium text-white/45">{label}</span>
		</div>
	);
}

function SharePicker({ contact, onClose }) {
	const [people, setPeople] = useState(null);
	const [sent, setSent] = useState({});

	useEffect(() => {
		let live = true;

		fetchNui('getNearby', {}, [
			{ source: 1, name: 'Sara Vance', number: '555-0110' },
			{ source: 2, name: 'Mikkel', number: '555-0192' },
		]).then((list) => live && setPeople(list || []));

		return () => {
			live = false;
		};
	}, []);

	const share = async (person) => {
		setSent((state) => ({ ...state, [person.source]: 'sending' }));

		const result = await fetchNui('shareContact', { target: person.source, id: contact?.id ?? null }, { name: 'ok' });

		setSent((state) => ({ ...state, [person.source]: result ? 'sent' : 'failed' }));
	};

	return (
		<motion.div
			initial={{ opacity: 0, height: 0 }}
			animate={{ opacity: 1, height: 'auto' }}
			className="mb-3 overflow-hidden rounded-2xl bg-white/[0.05]"
		>
			<div className="flex items-center justify-between px-4 pb-1 pt-3">
				<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
					Share {contact ? contact.name : 'my card'}
				</span>
				<button onClick={onClose} className="text-white/35 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
				</button>
			</div>

			{people === null ? (
				<p className="px-4 pb-3 text-[13px] text-white/35">Looking around…</p>
			) : people.length === 0 ? (
				<p className="px-4 pb-3 text-[13px] text-white/35">Nobody nearby.</p>
			) : (
				<div className="pb-2">
					{people.map((person) => (
						<button
							key={person.source}
							onClick={() => share(person)}
							disabled={Boolean(sent[person.source])}
							className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.05] disabled:opacity-60"
						>
							<Avatar name={person.name} size="h-9 w-9" />

							<span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
								{person.name}
							</span>

							<span className="shrink-0 text-[12px] font-semibold text-white/45">
								{sent[person.source] === 'sent'
									? 'Sent'
									: sent[person.source] === 'failed'
										? 'Failed'
										: sent[person.source]
											? '…'
											: 'Send'}
							</span>
						</button>
					))}
				</div>
			)}
		</motion.div>
	);
}

/**
 * Place a call.
 *
 * Shared by the Phone app and the Contacts app so dialling from either does
 * exactly the same thing — one implementation, not two that happen to look alike.
 *
 * @param {boolean} inline true when the caller has a call screen of its own and
 *   wants to own the call. The Phone app does; Contacts does not, so its calls
 *   are handed to the global overlay instead — otherwise a call placed from there
 *   would show nothing but the status-bar chip.
 */
export function useDial(inline = false) {
	const setCall = usePhoneStore((s) => s.setCall);
	const nameFor = useDataStore((s) => s.nameFor);

	return (number, name) => {
		if (!number) return;

		setCall({
			number,
			name: name ?? nameFor(number),
			direction: 'out',
			state: 'dialing',
			minimized: inline,
		});

		fetchNui('call', { number, name });
	};
}

export function ContactsTab({ onDial }) {
	const { contacts, name, number, removeContact } = useDataStore();
	const openApp = usePhoneStore((s) => s.openApp);

	const [query, setQuery] = useState('');
	const [menu, setMenu] = useState(null);
	const [editing, setEditing] = useState(null);
	const [adding, setAdding] = useState(false);

	const [sharing, setSharing] = useState(null);

	const sections = useMemo(() => {
		const needle = query.trim().toLowerCase();

		const filtered = contacts.filter(
			(c) => !needle || c.name.toLowerCase().includes(needle) || c.number.includes(needle)
		);

		const buckets = new Map();

		for (const contact of [...filtered].sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		)) {
			const first = contact.name.trim().charAt(0).toUpperCase();
			const letter = /[A-Z]/.test(first) ? first : '#';

			if (!buckets.has(letter)) buckets.set(letter, []);
			buckets.get(letter).push(contact);
		}

		return [...buckets.entries()];
	}, [contacts, query]);

	return (
		<>
			<Header
				title="Contacts"
				actions={
					<>
						<IconButton icon={Shield01Icon} />
						<IconButton icon={UserAdd01Icon} onClick={() => setAdding((v) => !v)} />
					</>
				}
			/>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5">
				<SearchField value={query} onChange={setQuery} />

				{adding && <ContactForm onClose={() => setAdding(false)} />}

				{!query && (
					<>
						<h2 className="mb-2 text-[16px] font-bold text-white">My Cards</h2>
						<div className="mb-5 flex items-center gap-3">
							<Avatar name={name} />
							<div className="min-w-0 flex-1">
								<div className="truncate text-[15px] font-bold text-white">{name || 'Unknown'}</div>
								<div className="truncate text-[13px] text-white/40">{number}</div>
							</div>
							<IconButton
								icon={Share01Icon}
								onClick={() => setSharing(sharing === 'me' ? null : 'me')}
							/>
						</div>

						{sharing === 'me' && <SharePicker contact={null} onClose={() => setSharing(null)} />}
					</>
				)}

				{sections.length === 0 ? (
					<Empty icon={UserIcon} label={query ? 'No matches' : 'No contacts yet'} />
				) : (
					sections.map(([letter, items]) => (
						<div key={letter}>
							<h3 className="sticky top-0 z-10 bg-black/80 py-1 text-[13px] font-bold text-white/50 backdrop-blur">
								{letter}
							</h3>

							{items.map((contact) => (
								<div key={contact.id}>
									<div className="flex items-center gap-3 py-2.5">
										<button
											onClick={() => setMenu(menu === contact.id ? null : contact.id)}
											className="flex min-w-0 flex-1 items-center gap-3 text-left"
										>
											<Avatar name={contact.name} avatar={contact.avatar} />
											<div className="min-w-0 flex-1">
												<div className="truncate text-[15px] font-bold text-white">{contact.name}</div>
												<div className="truncate text-[13px] text-white/40">{contact.number}</div>
											</div>
										</button>

										<div className="flex shrink-0 items-center gap-3.5 text-white/70">
											<button onClick={() => onDial(contact.number, contact.name)} className="transition hover:text-white">
												<HugeiconsIcon icon={Call02Icon} size={17} strokeWidth={1.9} />
											</button>
											<button
												onClick={() => openApp('messages', { number: contact.number })}
												className="transition hover:text-white"
											>
												<HugeiconsIcon icon={Message01Icon} size={17} strokeWidth={1.9} />
											</button>
										</div>
									</div>

									{editing === contact.id ? (
										<ContactForm contact={contact} onClose={() => setEditing(null)} />
									) : (
										menu === contact.id && (
											<motion.div
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: 'auto' }}
												className="flex gap-2 overflow-hidden pb-2"
											>
												<button
													onClick={() => {
														setEditing(contact.id);
														setMenu(null);
													}}
													className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] py-2 text-[13px] font-medium text-white"
												>
													<HugeiconsIcon icon={PencilEdit01Icon} size={15} strokeWidth={2} /> Edit
												</button>
												<button
													onClick={() => {
														setSharing(sharing === contact.id ? null : contact.id);
														setMenu(null);
													}}
													className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] py-2 text-[13px] font-medium text-white"
												>
													<HugeiconsIcon icon={Share01Icon} size={15} strokeWidth={2} /> Share
												</button>
												<button
													onClick={() => removeContact(contact.id)}
													className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500/15 py-2 text-[13px] font-medium text-rose-400"
												>
													<HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={2} /> Delete
												</button>
											</motion.div>
										)
									)}

									{sharing === contact.id && (
										<SharePicker contact={contact} onClose={() => setSharing(null)} />
									)}
								</div>
							))}
						</div>
					))
				)}
			</div>
		</>
	);
}

function ContactForm({ contact, onClose }) {
	const addContact = useDataStore((s) => s.addContact);
	const photos = useDataStore((s) => s.photos);

	const [name, setName] = useState(contact?.name ?? '');
	const [number, setNumber] = useState(contact?.number ?? '');
	const [avatar, setAvatar] = useState(contact?.avatar ?? '');
	const [picking, setPicking] = useState(false);

	const submit = (event) => {
		event.preventDefault();
		if (!name.trim() || !number.trim()) return;

		addContact({
			id: contact?.id,
			name: name.trim(),
			number: number.trim(),
			avatar: avatar.trim() || null,
		});
		onClose();
	};

	return (
		<form onSubmit={submit} className="mb-5 space-y-2 rounded-2xl bg-white/[0.05] p-4">
			<div className="mb-3 flex items-center gap-3">
				<Avatar name={name} avatar={avatar || null} size="h-14 w-14" />

				<div className="min-w-0 flex-1">
					<div className="text-[13px] font-bold text-white">Picture</div>
					<div className="flex gap-2 pt-1.5">
						<button
							type="button"
							onClick={() => setPicking((v) => !v)}
							className="rounded-lg bg-white/[0.09] px-2.5 py-1 text-[12px] font-medium text-white"
						>
							Gallery
						</button>
						{avatar && (
							<button
								type="button"
								onClick={() => setAvatar('')}
								className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[12px] font-medium text-rose-400"
							>
								Remove
							</button>
						)}
					</div>
				</div>
			</div>

			{picking && (
				<div className="royal-scroll mb-2 flex gap-2 overflow-x-auto rounded-xl bg-black/25 p-2">
					{photos.length === 0 ? (
						<span className="px-2 py-3 text-[12px] text-white/35">No photos yet.</span>
					) : (
						photos.map((photo, index) => (
							<button
								key={`${photo.takenAt}-${index}`}
								type="button"
								onClick={() => {
									setAvatar(photo.id ? photoRef(photo.id) : (photo.url ?? ''));
									setPicking(false);
								}}
								className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]"
							>
								{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
							</button>
						))
					)}
				</div>
			)}

			{isPhotoRef(avatar) ? (
				<div className="w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[13px] text-white/45">
					Using a photo from the gallery
				</div>
			) : (
				<input
					value={avatar}
					onChange={(e) => setAvatar(e.target.value)}
					placeholder="Picture URL"
					spellCheck={false}
					className="w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[13px] text-white outline-none placeholder:text-white/30"
				/>
			)}
			<input
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Name"
				autoFocus={!contact}
				className="w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
			/>
			<input
				value={number}
				onChange={(e) => setNumber(e.target.value)}
				placeholder="Number"
				className="w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
			/>

			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={onClose}
					className="flex-1 rounded-xl bg-white/[0.07] py-2.5 text-[13.5px] font-medium text-white/70"
				>
					Cancel
				</button>
				<button type="submit" className="flex-1 rounded-xl bg-white py-2.5 text-[13.5px] font-bold text-black">
					Save
				</button>
			</div>
		</form>
	);
}

function CallsTab({ onDial, focus }) {
	const { calls, number, contacts, nameFor, contactFor } = useDataStore();
	const [query, setQuery] = useState('');
	const [highlight, setHighlight] = useState(null);
	const rows = useRef(new Map());

	const recents = useMemo(() => {
		const rows = calls.map((entry) => {
			const outgoing = entry.caller === number;
			const other = outgoing ? entry.receiver : entry.caller;

			return {
				...entry,
				other,
				name: nameFor(other),
				avatar: contactFor(other)?.avatar,
				direction: outgoing ? 'out' : entry.answered ? 'in' : 'missed',
			};
		});

		const needle = query.trim().toLowerCase();
		if (!needle) return rows;

		return rows.filter((r) => r.name.toLowerCase().includes(needle) || r.other.includes(needle));
	}, [calls, number, contacts, query]);

	// Opened from a missed-call notification: scroll to that call and flash it.
	// Matches the logged call id, else the newest call with that number. The log
	// may still be refreshing when the app opens, so it retries as calls arrive.
	const target = useMemo(() => {
		if (!focus) return null;

		const byId = focus.id != null ? recents.find((r) => String(r.id) === String(focus.id)) : null;
		return byId ?? (focus.number ? recents.find((r) => r.other === focus.number) : null) ?? null;
	}, [focus, recents]);

	useEffect(() => {
		if (!target) return;

		setHighlight(target.id);
		rows.current.get(target.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });

		const timer = setTimeout(() => setHighlight(null), 2200);
		return () => clearTimeout(timer);
	}, [target?.id, focus]);

	const glyph = { out: CallOutgoing01Icon, in: CallIncoming01Icon, missed: CallMissed01Icon };

	return (
		<>
			<Header title="Calls" />

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5">
				<SearchField value={query} onChange={setQuery} />

				{recents.length === 0 ? (
					<Empty icon={Clock01Icon} label="No calls yet" />
				) : (
					<div className="pb-2">
						{recents.map((entry) => (
							<div
								key={entry.id}
								ref={(node) => (node ? rows.current.set(entry.id, node) : rows.current.delete(entry.id))}
								className={`-mx-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-700 ${
									highlight === entry.id ? 'bg-white/[0.09]' : 'bg-transparent'
								}`}
							>
								<Avatar
									name={entry.name === entry.other ? null : entry.name}
									avatar={entry.avatar}
									size="h-11 w-11"
								/>

								<div className="min-w-0 flex-1">
									<div
										className={`truncate text-[15px] font-bold ${
											entry.direction === 'missed' ? 'text-rose-400' : 'text-white'
										}`}
									>
										{entry.name}
									</div>
									<div className="flex items-center gap-1.5 text-[12.5px] text-white/40">
										<HugeiconsIcon icon={glyph[entry.direction]} size={13} strokeWidth={2} />
										<span className="truncate">{formatRelative(entry.createdAt)}</span>
									</div>
								</div>

								<button
									onClick={() => onDial(entry.other, entry.name)}
									className="shrink-0 text-white/70 transition hover:text-white"
								>
									<HugeiconsIcon icon={Call02Icon} size={17} strokeWidth={1.9} />
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function KeypadTab({ onDial }) {
	const [value, setValue] = useState('');
	const nameFor = useDataStore((s) => s.nameFor);

	const known = value && nameFor(value) !== value ? nameFor(value) : null;

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8">
			<div className="flex h-12 flex-col items-center justify-center">
				<span className="text-center text-[30px] font-normal tracking-[0.06em] text-white">{value}</span>
				{known && <span className="mt-0.5 text-[13px] text-emerald-400">{known}</span>}
			</div>

			<div className="grid w-full max-w-[240px] grid-cols-3 gap-y-6">
				{KEYS.map((key) => (
					<motion.button
						key={key}
						whileTap={{ scale: 0.85, color: 'rgb(52 211 153)' }}
						onClick={() => setValue((v) => (v.length < 15 ? v + key : v))}
						onContextMenu={(e) => {
							e.preventDefault();
							setValue((v) => v.slice(0, -1));
						}}
						className="grid h-12 place-items-center text-[30px] font-normal leading-none text-white"
					>
						{key}
					</motion.button>
				))}
			</div>

			<div className="flex items-center gap-6">
				<motion.button
					whileTap={{ scale: 0.9 }}
					onClick={() => onDial(value)}
					disabled={!value}
					className="grid h-[58px] w-[58px] place-items-center rounded-[30%] bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40"
				>
					<HugeiconsIcon icon={Call02Icon} size={26} strokeWidth={2} />
				</motion.button>

				{value && (
					<motion.button
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						onClick={() => setValue((v) => v.slice(0, -1))}
						className="absolute right-10 text-white/45 transition hover:text-white"
					>
						<HugeiconsIcon icon={Delete02Icon} size={22} strokeWidth={1.9} />
					</motion.button>
				)}
			</div>
		</div>
	);
}

const TABS = [
	{ id: 'calls', label: 'Calls', icon: Clock01Icon },
	{ id: 'keypad', label: 'Keypad', icon: DialpadCircle01Icon },
	{ id: 'messages', label: 'Messages', icon: Message01Icon },
	{ id: 'contacts', label: 'Contacts', icon: Contact01Icon },
];

/**
 * The bottom navigation shared by the Phone app and the Contacts app.
 *
 * Four slots across three apps: Calls and Keypad are screens inside the Phone
 * app, Messages and Contacts are apps of their own. Which one is highlighted is
 * passed in, so whichever app you are standing in the bar reads the same and the
 * other three are one tap away.
 *
 * @param {string} active id of the highlighted tab
 * @param {(id: string) => void} [onSelect] handles the tabs this app owns; the
 *   rest are routed to their own apps here.
 */
export function PhoneNav({ active, onSelect }) {
	const openApp = usePhoneStore((s) => s.openApp);

	const select = (id) => {
		if (id === active) return;

		if (id === 'messages') return openApp('messages');
		if (id === 'contacts') return openApp('contacts');

		if (onSelect) return onSelect(id);
		openApp('dialer', { tab: id });
	};

	return (
		<nav className="mx-4 mb-1 flex shrink-0 items-center justify-around rounded-3xl bg-white/[0.05] p-1.5">
			{TABS.map((item) => {
				const on = active === item.id;

				return (
					<button
						key={item.id}
						onClick={() => select(item.id)}
						className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition ${
							on ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70'
						}`}
					>
						<HugeiconsIcon icon={item.icon} size={19} strokeWidth={on ? 2 : 1.7} />
						<span className="text-[10px] font-medium">{item.label}</span>
					</button>
				);
			})}
		</nav>
	);
}

export default function DialerApp({ initial }) {
	const [tab, setTab] = useState(initial?.tab === 'keypad' ? 'keypad' : 'calls');

	// A notification tapped while the app is already open hands it a new route.
	useEffect(() => {
		if (initial?.tab === 'keypad' || initial?.tab === 'calls') setTab(initial.tab);
	}, [initial]);

	const call = usePhoneStore((s) => s.call);
	const setCall = usePhoneStore((s) => s.setCall);

	const dial = useDial(true);

	const endCall = () => {
		fetchNui('endCall');
		setCall(null);
	};

	const inCall = call && call.minimized;

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			{inCall ? (
				<CallScreen call={call} onEnd={endCall} />
			) : (
				<>
					{tab === 'calls' && <CallsTab onDial={dial} focus={initial?.tab === 'calls' ? initial : null} />}
					{tab === 'keypad' && <KeypadTab onDial={dial} />}
				</>
			)}

			<PhoneNav active={inCall ? null : tab} onSelect={setTab} />
		</div>
	);
}
