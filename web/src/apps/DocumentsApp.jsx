import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	File01Icon,
	FileAddIcon,
	Search01Icon,
	ArrowLeft01Icon,
	MoreVerticalIcon,
	UserAdd01Icon,
	Delete02Icon,
	Cancel01Icon,
	TextBoldIcon,
	TextItalicIcon,
	TextUnderlineIcon,
	TextStrikethroughIcon,
	LeftToRightListBulletIcon,
	LeftToRightListNumberIcon,
	QuoteDownIcon,
	PaintBoardIcon,
	UserGroupIcon,
	PencilEdit01Icon,
	ViewIcon,
	Tick02Icon,
	InboxIcon,
	Notification01Icon,
	ArrowDown01Icon,
	UserIcon,
	FloppyDiskIcon,
	SquareLock02Icon,
} from '@hugeicons/core-free-icons';

import { Avatar } from './_shared';
import useDocumentsStore from '../state/documentsStore';
import useDataStore from '../state/dataStore';
import { BANNERS, bannerFor } from '../config/banners';
import { sanitizeHtml, toPlainText, countWords } from '../utils/richtext';
import { formatRelative } from '../utils/format';
import fetchNui from '../utils/fetchNui';

/**
 * The two action buttons under a document: a lit primary and a glass ghost.
 *
 * Both carry a hairline border and a soft inner highlight so they read as raised
 * glass rather than flat fills — the primary gets a blue glow underneath it, the
 * ghost only the border.
 */
const GLASS_BASE =
	'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-bold ' +
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition ' +
	'disabled:pointer-events-none disabled:opacity-50';

const GLASS_PRIMARY =
	`${GLASS_BASE} border border-sky-400/40 bg-sky-600/80 text-white ` +
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_20px_-6px_rgba(56,189,248,0.7)] hover:bg-sky-500/90';

const GLASS_GHOST =
	`${GLASS_BASE} border border-white/[0.14] bg-white/[0.05] text-white/80 hover:bg-white/[0.09] hover:text-white`;

//#region shared

function Header({ title, actions, onBack }) {
	return (
		<header className="flex shrink-0 items-center gap-1 px-5 pb-3 pt-1">
			{onBack && (
				<button
					onClick={onBack}
					className="-ml-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2} />
				</button>
			)}

			<h1 className="min-w-0 flex-1 truncate text-[26px] font-bold leading-tight tracking-tight text-white">
				{title}
			</h1>

			{actions}
		</header>
	);
}

function IconButton({ icon, onClick, active, disabled, className = '' }) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/20 ${
				active ? 'bg-white/10 text-white' : 'text-white/70'
			} ${className}`}
		>
			<HugeiconsIcon icon={icon} size={18} strokeWidth={1.9} />
		</button>
	);
}

function Empty({ icon, label, hint }) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
			<HugeiconsIcon icon={icon} size={34} strokeWidth={1.4} className="text-white/30" />
			<div>
				<div className="text-[14px] font-medium text-white/45">{label}</div>
				{hint && <div className="mt-0.5 text-[12.5px] text-white/30">{hint}</div>}
			</div>
		</div>
	);
}

//#endregion

//#region list

/**
 * Where a document is in its life, which is what the list is sorted and filtered
 * by. Derived rather than stored: the signature rows already say all of this, and
 * a second copy of the truth would only get out of step with them.
 */
export function statusOf(doc) {
	if (!doc.signable) return STATUS.draft;
	if (doc.sealed) return STATUS.completed;
	if (doc.canSign) return STATUS.awaiting;
	return STATUS.pending;
}

const STATUS = {
	draft: { id: 'draft', label: 'Draft', className: 'text-violet-400' },
	pending: { id: 'pending', label: 'Pending', className: 'text-amber-400' },
	awaiting: { id: 'awaiting', label: 'Needs you', className: 'text-sky-400' },
	completed: { id: 'completed', label: 'Completed', className: 'text-emerald-400' },
};

const FILTERS = [
	{ id: 'all', label: 'All' },
	{ id: 'draft', label: 'Drafts' },
	{ id: 'awaiting', label: 'Needs you' },
	{ id: 'pending', label: 'Pending' },
	{ id: 'completed', label: 'Completed' },
];

/**
 * A document card.
 *
 * Status first, then the title, then what the document is waiting on — the same
 * order you would read it in. The banner is a thin bar down the left rather than
 * a wash behind the text: at this density a full-bleed gradient fought with the
 * status colour, which is the more useful signal.
 */
function DocumentCard({ doc, onOpen }) {
	const banner = bannerFor(doc.banner);
	const status = statusOf(doc);

	const outstanding = (doc.signatures ?? []).filter((s) => !s.signed).length;

	const meta = doc.signable
		? doc.sealed
			? `Signed by ${doc.signatures.length}`
			: `${outstanding} of ${doc.signatures.length} left to sign`
		: toPlainText(doc.body) || 'Empty document';

	return (
		<button
			onClick={() => onOpen(doc.id)}
			className="relative mb-2.5 w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.06]"
		>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
				style={{ background: banner.css }}
			/>

			<div className="flex items-start justify-between gap-3">
				<span className={`text-[10.5px] font-bold uppercase tracking-[0.12em] ${status.className}`}>
					{status.label}
				</span>
				<span className="shrink-0 text-[11.5px] text-white/35">{formatRelative(doc.updatedAt)}</span>
			</div>

			<div className="mt-1.5 flex items-start gap-2.5">
				<HugeiconsIcon
					icon={doc.signable ? File01Icon : PencilEdit01Icon}
					size={16}
					strokeWidth={1.9}
					className="mt-[3px] shrink-0 text-sky-400"
				/>

				<div className="min-w-0 flex-1">
					<div className="text-[14.5px] font-bold leading-snug text-white">
						{doc.title || 'Untitled document'}
					</div>

					<div className="mt-1 truncate text-[12px] text-white/35">{meta}</div>
				</div>
			</div>

			{!doc.mine && (
				<div className="mt-1.5 text-[11.5px] text-white/30">Shared by {doc.owner}</div>
			)}
		</button>
	);
}

function Inbox({ onOpen }) {
	const documents = useDocumentsStore((s) => s.documents);

	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState('all');
	const [picking, setPicking] = useState(false);

	const shown = useMemo(() => {
		const needle = query.trim().toLowerCase();

		return [...documents]
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.filter((doc) => filter === 'all' || statusOf(doc).id === filter)
			.filter(
				(doc) =>
					!needle ||
					doc.title.toLowerCase().includes(needle) ||
					toPlainText(doc.body).toLowerCase().includes(needle)
			);
	}, [documents, query, filter]);

	const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-2">
			<div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.05] px-4 py-3">
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search documents"
					className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
				/>
				<HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={2} className="shrink-0 text-white/45" />
			</div>

			{/* Filter and count on one line, the way the reference reads it. */}
			<button
				onClick={() => setPicking((v) => !v)}
				className="mb-3 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 transition hover:bg-white/[0.06]"
			>
				<span className="text-[13.5px] font-medium text-white">{active.label}</span>
				<span className="flex items-center gap-1.5 text-[13px] text-white/40">
					{shown.length}
					<HugeiconsIcon
						icon={ArrowDown01Icon}
						size={15}
						strokeWidth={2}
						className={`transition-transform ${picking ? 'rotate-180' : ''}`}
					/>
				</span>
			</button>

			<AnimatePresence>
				{picking && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="mb-3 overflow-hidden"
					>
						<div className="flex flex-wrap gap-1.5">
							{FILTERS.map((item) => (
								<button
									key={item.id}
									onClick={() => {
										setFilter(item.id);
										setPicking(false);
									}}
									className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
										filter === item.id
											? 'bg-white/[0.14] text-white'
											: 'bg-white/[0.05] text-white/45 hover:text-white/80'
									}`}
								>
									{item.label}
								</button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{shown.length === 0 ? (
				<Empty
					icon={File01Icon}
					label={query || filter !== 'all' ? 'Nothing here' : 'No documents yet'}
					hint={query || filter !== 'all' ? null : 'Start one with the + button.'}
				/>
			) : (
				shown.map((doc) => <DocumentCard key={doc.id} doc={doc} onOpen={onOpen} />)
			)}
		</div>
	);
}

/** Everything waiting on you, and what has moved recently. */
function Notifications({ onOpen }) {
	const documents = useDocumentsStore((s) => s.documents);

	const needsYou = documents.filter((doc) => doc.canSign);
	const recent = documents
		.filter((doc) => doc.signable && !doc.canSign)
		.sort((a, b) => b.updatedAt - a.updatedAt);

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-2">
			{needsYou.length === 0 && recent.length === 0 ? (
				<Empty icon={Notification01Icon} label="Nothing to sign" hint="Signature requests land here." />
			) : (
				<>
					{needsYou.length > 0 && (
						<>
							<h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
								Waiting on you
							</h2>
							{needsYou.map((doc) => (
								<DocumentCard key={doc.id} doc={doc} onOpen={onOpen} />
							))}
						</>
					)}

					{recent.length > 0 && (
						<>
							<h2 className="mb-2 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
								Activity
							</h2>
							{recent.map((doc) => (
								<DocumentCard key={doc.id} doc={doc} onOpen={onOpen} />
							))}
						</>
					)}
				</>
			)}
		</div>
	);
}

/**
 * Starting points. Each one is a title and a body the new document opens with —
 * add to this list to give your server its own paperwork.
 */
const TEMPLATES = [
	{
		id: 'blank',
		label: 'Blank document',
		hint: 'Start from nothing',
		banner: 'slate',
		title: 'Untitled document',
		body: '',
	},
	{
		id: 'contract',
		label: 'Investment agreement',
		hint: 'Two parties, equity for cash',
		banner: 'legal',
		title: 'Investment Agreement',
		body:
			'<h1>Investment Agreement</h1>' +
			'<p>This Agreement is entered into between the Company Representative and the Investor under the laws of the State of San Andreas.</p>' +
			'<h2>Terms</h2>' +
			'<p>The Investor agrees to provide $[amount] to the Company. In exchange, the Company shall issue ownership shares at a rate of 1% equity for every $1,000 invested.</p>' +
			'<p>The Company represents that it has authority to issue such shares. Ownership rights shall become effective upon receipt of the investment funds.</p>' +
			'<blockquote>This Agreement constitutes the entire understanding between the parties and may only be modified in writing signed by both parties.</blockquote>',
	},
	{
		id: 'employment',
		label: 'Employment contract',
		hint: 'Role, pay and hours',
		banner: 'ocean',
		title: 'Employment Contract',
		body:
			'<h1>Employment Contract</h1>' +
			'<h2>Position</h2><p>Role: [position]<br>Start date: [date]</p>' +
			'<h2>Compensation</h2><p>$[amount] per shift, paid weekly.</p>' +
			'<h2>Termination</h2><p>Either party may end this agreement with notice.</p>',
	},
	{
		id: 'bill',
		label: 'Bill of sale',
		hint: 'Transfer of property',
		banner: 'sand',
		title: 'Bill of Sale',
		body:
			'<h1>Bill of Sale</h1>' +
			'<p>The Seller transfers ownership of the property described below to the Buyer for the sum of $[amount].</p>' +
			'<h2>Property</h2><p>[description]</p>' +
			'<p>The Seller warrants that the property is free of any lien or claim.</p>',
	},
];

function Templates({ onOpen }) {
	const createFrom = useDocumentsStore((s) => s.createFrom);

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-2">
			<h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
				Start from
			</h2>

			{TEMPLATES.map((template) => (
				<button
					key={template.id}
					onClick={async () => onOpen(await createFrom(template))}
					className="relative mb-2.5 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 text-left transition hover:border-white/[0.14] hover:bg-white/[0.06]"
				>
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
						style={{ background: bannerFor(template.banner).css }}
					/>

					<HugeiconsIcon icon={File01Icon} size={17} strokeWidth={1.9} className="shrink-0 text-sky-400" />

					<div className="min-w-0 flex-1">
						<div className="truncate text-[14.5px] font-bold text-white">{template.label}</div>
						<div className="truncate text-[12px] text-white/35">{template.hint}</div>
					</div>
				</button>
			))}
		</div>
	);
}

//#endregion

//#region editor

const TOOLS = [
	{ id: 'bold', command: 'bold', icon: TextBoldIcon },
	{ id: 'italic', command: 'italic', icon: TextItalicIcon },
	{ id: 'underline', command: 'underline', icon: TextUnderlineIcon },
	{ id: 'strike', command: 'strikeThrough', icon: TextStrikethroughIcon },
	{ id: 'bullets', command: 'insertUnorderedList', icon: LeftToRightListBulletIcon },
	{ id: 'numbers', command: 'insertOrderedList', icon: LeftToRightListNumberIcon },
	{ id: 'quote', command: 'formatBlock', value: 'blockquote', icon: QuoteDownIcon },
];

const BLOCKS = [
	{ id: 'p', label: 'Body', value: 'p' },
	{ id: 'h1', label: 'Title', value: 'h1' },
	{ id: 'h2', label: 'Heading', value: 'h2' },
	{ id: 'h3', label: 'Subheading', value: 'h3' },
];

/**
 * The editing surface.
 *
 * contentEditable + execCommand. The API is deprecated but it is the only
 * rich-text primitive every Chromium build — CEF included — implements the
 * same way, and it keeps a whole editor library out of a bundle that is read
 * off disk on every phone open.
 *
 * The element is deliberately uncontrolled: React writes the initial HTML once
 * and never again, because re-rendering a contentEditable from state moves the
 * caret to the start on every keystroke.
 */
function Editor({ doc, onChange }) {
	const ref = useRef(null);
	const [active, setActive] = useState({});

	useEffect(() => {
		if (ref.current) ref.current.innerHTML = sanitizeHtml(doc.body);
	}, [doc.id]);

	useEffect(() => {
		const node = ref.current;
		if (!node || node === document.activeElement) return;

		const incoming = sanitizeHtml(doc.body);
		if (node.innerHTML !== incoming) node.innerHTML = incoming;
	}, [doc.body]);

	/** Which buttons should look pressed for the current selection. */
	const refreshState = () => {
		if (!doc.canEdit) return;

		const state = {};
		for (const tool of TOOLS) {
			if (tool.command === 'formatBlock') continue;
			try {
				state[tool.id] = document.queryCommandState(tool.command);
			} catch {
				state[tool.id] = false;
			}
		}
		setActive(state);
	};

	const run = (tool) => {
		if (!doc.canEdit) return;

		ref.current?.focus();
		document.execCommand(tool.command, false, tool.value ?? null);

		onChange(sanitizeHtml(ref.current?.innerHTML ?? ''));
		refreshState();
	};

	const setBlock = (value) => {
		ref.current?.focus();
		document.execCommand('formatBlock', false, value);
		onChange(sanitizeHtml(ref.current?.innerHTML ?? ''));
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
				<div
					ref={ref}
					contentEditable={doc.canEdit}
					suppressContentEditableWarning
					spellCheck={false}
					onInput={() => onChange(sanitizeHtml(ref.current?.innerHTML ?? ''))}
					onKeyUp={refreshState}
					onMouseUp={refreshState}
					// Paste as plain text: whatever is on the clipboard is not ours
					// to trust, and the sanitiser would strip its markup anyway.
					onPaste={(event) => {
						event.preventDefault();
						const text = event.clipboardData.getData('text/plain');
						document.execCommand('insertText', false, text);
					}}
					data-placeholder="Start writing…"
					className="royal-doc min-h-full text-[14px] leading-relaxed text-white/85 outline-none"
				/>
			</div>

			{doc.canEdit && (
				<div className="shrink-0 border-t border-white/[0.07] bg-black/40 backdrop-blur-xl">
					<div className="royal-scroll-x flex items-center gap-1 overflow-x-auto px-3 py-2">
						{BLOCKS.map((block) => (
							<button
								key={block.id}
								onClick={() => setBlock(block.value)}
								className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"
							>
								{block.label}
							</button>
						))}

						<span className="mx-1 h-5 w-px shrink-0 bg-white/10" />

						{TOOLS.map((tool) => (
							<button
								key={tool.id}
								onClick={() => run(tool)}
								className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:bg-white/10 hover:text-white ${
									active[tool.id] ? 'bg-white/[0.14] text-white' : 'text-white/50'
								}`}
							>
								<HugeiconsIcon icon={tool.icon} size={17} strokeWidth={1.9} />
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

//#endregion

//#region sheets

function BannerPicker({ doc, onPick, onClose }) {
	return (
		<div className="px-5 pb-3">
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Banner</h2>
				<button onClick={onClose} className="text-white/35 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
				</button>
			</div>

			<div className="grid grid-cols-5 gap-2">
				{BANNERS.map((banner) => (
					<button
						key={banner.id}
						onClick={() => onPick(banner.id)}
						title={banner.label}
						className={`grid h-10 place-items-center rounded-xl transition ${
							doc.banner === banner.id ? 'ring-2 ring-white' : 'ring-1 ring-white/10 hover:ring-white/30'
						}`}
						style={{ background: banner.css }}
					>
						{doc.banner === banner.id && (
							<HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.6} className="text-white drop-shadow" />
						)}
					</button>
				))}
			</div>
		</div>
	);
}

/**
 * The guest list.
 *
 * You can only invite someone you already know — a saved contact, or a player
 * standing next to you. There is deliberately no "invite by number" box: the
 * server enforces the same two rules, and a free-text field would just be a way
 * to discover which numbers exist by trying them.
 */
function SharePanel({ doc, onClose }) {
	const contacts = useDataStore((s) => s.contacts);
	const invite = useDocumentsStore((s) => s.invite);
	const uninvite = useDocumentsStore((s) => s.uninvite);

	const [source, setSource] = useState('contacts');
	const [canEdit, setCanEdit] = useState(true);
	const [nearby, setNearby] = useState(null);
	const [error, setError] = useState(null);

	// Nearby is a snapshot taken when the tab is opened — people walk off, and a
	// list that re-queried on a timer would be a query every second for nothing.
	useEffect(() => {
		if (source !== 'nearby' || nearby !== null) return;

		let live = true;

		fetchNui('getNearby', {}, [
			{ source: 1, name: 'Sara Vance', number: '555-0110' },
			{ source: 2, name: 'Mikkel', number: '555-0192' },
		]).then((list) => live && setNearby(list || []));

		return () => {
			live = false;
		};
	}, [source, nearby]);

	const add = async (number, name) => {
		setError(null);

		const ok = await invite(doc.id, number, canEdit, name);
		if (!ok) setError('Could not share with them — they need to be a contact or nearby.');
	};

	const already = (number) => doc.shares.some((s) => s.number === number);

	const people =
		source === 'contacts'
			? contacts.map((c) => ({ key: c.id, name: c.name, number: c.number }))
			: (nearby ?? []).map((p) => ({ key: p.source, name: p.name, number: p.number }));

	return (
		<div className="px-5 pb-3">
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">People</h2>

				<div className="flex items-center gap-2">
					<button
						onClick={() => setCanEdit((v) => !v)}
						title={canEdit ? 'Invites can edit' : 'Invites can read only'}
						className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold transition ${
							canEdit ? 'bg-sky-500/20 text-sky-400' : 'bg-white/[0.07] text-white/45'
						}`}
					>
						<HugeiconsIcon icon={canEdit ? PencilEdit01Icon : ViewIcon} size={12} strokeWidth={2} />
						{canEdit ? 'Can edit' : 'Read only'}
					</button>

					<button onClick={onClose} className="text-white/35 transition hover:text-white">
						<HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
					</button>
				</div>
			</div>

			<div className="mb-2 flex gap-1 rounded-xl bg-black/30 p-1">
				{[
					{ id: 'contacts', label: 'Contacts' },
					{ id: 'nearby', label: 'Nearby' },
				].map((option) => (
					<button
						key={option.id}
						onClick={() => setSource(option.id)}
						className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition ${
							source === option.id ? 'bg-white text-black' : 'text-white/50'
						}`}
					>
						{option.label}
					</button>
				))}
			</div>

			{source === 'nearby' && nearby === null ? (
				<p className="px-1 pb-2 text-[12.5px] text-white/30">Looking around…</p>
			) : people.length === 0 ? (
				<p className="px-1 pb-2 text-[12.5px] text-white/30">
					{source === 'nearby' ? 'Nobody nearby.' : 'No contacts to invite.'}
				</p>
			) : (
				<div className="mb-1">
					{people.map((person) => (
						<button
							key={person.key}
							onClick={() => add(person.number, person.name)}
							disabled={already(person.number)}
							className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-white/[0.05] disabled:opacity-40"
						>
							<Avatar name={person.name} size="h-9 w-9" />

							<span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
								{person.name}
							</span>

							<span className="shrink-0 text-[12px] font-semibold text-white/45">
								{already(person.number) ? 'Invited' : 'Invite'}
							</span>
						</button>
					))}
				</div>
			)}

			{error && <p className="mb-2 px-1 text-[12px] text-rose-400">{error}</p>}

			<h2 className="mb-1 mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
				On this document
			</h2>

			{doc.shares.length === 0 ? (
				<p className="px-1 pb-1 text-[12.5px] text-white/30">Only you can see this document.</p>
			) : (
				doc.shares.map((share) => (
					<div key={share.number} className="flex items-center gap-3 py-2">
						<Avatar name={share.name} size="h-9 w-9" />

						<div className="min-w-0 flex-1">
							<div className="truncate text-[14px] font-bold text-white">{share.name}</div>
							<div className="truncate text-[12px] text-white/40">
								{share.number} · {share.canEdit ? 'Can edit' : 'Can read'}
							</div>
						</div>

						<button
							onClick={() => uninvite(doc.id, share.number)}
							className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/35 transition hover:bg-white/10 hover:text-rose-400"
						>
							<HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2.2} />
						</button>
					</div>
				))
			)}
		</div>
	);
}

//#endregion

//#region document

function DocumentScreen({ id, onBack }) {
	const doc = useDocumentsStore((s) => s.documents.find((item) => item.id === id));
	const update = useDocumentsStore((s) => s.update);
	const flush = useDocumentsStore((s) => s.flush);
	const save = useDocumentsStore((s) => s.save);
	const requestSignatures = useDocumentsStore((s) => s.requestSignatures);
	const remove = useDocumentsStore((s) => s.remove);

	/** 'banner' | 'share' | 'menu' | null — only one sheet at a time. */
	const [sheet, setSheet] = useState(null);

	const [saveState, setSaveState] = useState(null);

	const [sending, setSending] = useState(false);
	const [sendError, setSendError] = useState(null);

	// The debounce is generous; leaving the screen must not lose the tail of it.
	useEffect(() => () => flush(id), [id]);

	useEffect(() => {
		if (saveState !== 'saved') return;

		const timer = setTimeout(() => setSaveState(null), 1600);
		return () => clearTimeout(timer);
	}, [saveState]);

	if (!doc) return null;

	const banner = bannerFor(doc.banner);
	const words = countWords(doc.body);

	return (
		<>
			{/* The banner runs full bleed behind the header, which is why the
			    header is drawn over it rather than above it. */}
			<div className="relative shrink-0" style={{ paddingTop: 'var(--status-h)' }}>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-[150%]"
					style={{
						background: banner.css,
						maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)',
						WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)',
					}}
				/>

				<div className="relative flex items-center gap-1 px-5 pb-2 pt-1">
					<button
						onClick={onBack}
						className="-ml-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-black/25 hover:text-white"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2} />
					</button>

					<span className="min-w-0 flex-1" />

					{doc.canEdit && (
						<button
							onClick={async () => {
								setSaveState('saving');
								const result = await save(id);
								setSaveState(result?.ok ? 'saved' : null);
							}}
							disabled={saveState === 'saving'}
							className={`mr-1 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition disabled:opacity-60 ${
								saveState === 'saved'
									? 'bg-emerald-500/15 text-emerald-400'
									: 'bg-white/[0.09] text-white/85 hover:bg-white/[0.14] hover:text-white'
							}`}
						>
							<HugeiconsIcon
								icon={saveState === 'saved' ? Tick02Icon : FloppyDiskIcon}
								size={14}
								strokeWidth={2.2}
							/>
							{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
						</button>
					)}

					{doc.mine && !doc.signable && (
						<button
							onClick={async () => {
								setSending(true);
								const result = await requestSignatures(id, true);
								setSending(false);
								setSendError(result?.error ?? null);
							}}
							disabled={sending}
							className="mr-1 flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600/85 px-3 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-sky-500/90 disabled:opacity-60"
						>
							<HugeiconsIcon icon={PencilEdit01Icon} size={14} strokeWidth={2.2} />
							{sending ? 'Sending…' : 'Sign'}
						</button>
					)}

					{doc.canEdit && (
						<IconButton
							icon={PaintBoardIcon}
							active={sheet === 'banner'}
							onClick={() => setSheet(sheet === 'banner' ? null : 'banner')}
							className="text-white/80"
						/>
					)}

					{doc.mine && (
						<IconButton
							icon={UserAdd01Icon}
							active={sheet === 'share'}
							onClick={() => setSheet(sheet === 'share' ? null : 'share')}
							className="text-white/80"
						/>
					)}

					<IconButton
						icon={MoreVerticalIcon}
						active={sheet === 'menu'}
						onClick={() => setSheet(sheet === 'menu' ? null : 'menu')}
						className="text-white/80"
					/>
				</div>

				<div className="relative px-5 pb-3">
					<input
						value={doc.title}
						readOnly={!doc.canEdit}
						onChange={(e) => update(id, { title: e.target.value.slice(0, 64) })}
						placeholder="Untitled document"
						className="w-full bg-transparent text-[24px] font-bold leading-tight tracking-tight text-white outline-none placeholder:text-white/40"
					/>

					<div className="mt-1 flex items-center gap-2 text-[11.5px] text-white/50">
						<span>{doc.mine ? 'You' : doc.owner}</span>
						<span>·</span>
						<span>{formatRelative(doc.updatedAt)}</span>
						{!doc.canEdit && (
							<>
								<span>·</span>
								<span className="flex items-center gap-1">
									<HugeiconsIcon icon={ViewIcon} size={11} strokeWidth={2} /> Read only
								</span>
							</>
						)}
					</div>

					{sendError && <p className="mt-1.5 text-[12px] text-rose-400">{sendError}</p>}
				</div>
			</div>

			<AnimatePresence>
				{sheet && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="shrink-0 overflow-hidden border-b border-white/[0.07] bg-white/[0.03]"
					>
						{sheet === 'banner' && (
							<BannerPicker doc={doc} onPick={(value) => update(id, { banner: value })} onClose={() => setSheet(null)} />
						)}

						{sheet === 'share' && <SharePanel doc={doc} onClose={() => setSheet(null)} />}

						{sheet === 'menu' && (
							<div className="px-5 py-2">
								<div className="flex items-center justify-between py-1.5 text-[13px] text-white/45">
									<span>{words} word{words === 1 ? '' : 's'}</span>
									<span>{doc.shares.length} invited</span>
								</div>

								{doc.mine && (
									<button
										onClick={() => {
											remove(id);
											onBack();
										}}
										className="flex w-full items-center gap-2 py-2 text-left text-[14px] font-medium text-rose-400"
									>
										<HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.9} /> Delete document
									</button>
								)}
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			<Editor doc={doc} onChange={(body) => update(id, { body })} />

			<SignatureBar doc={doc} onBack={onBack} />
		</>
	);
}

/**
 * The signature block and the two actions under it.
 *
 * Only shown once the document has been sent round — a draft has nothing to sign
 * and no parties to list.
 */
function SignatureBar({ doc }) {
	const sign = useDocumentsStore((s) => s.sign);

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const [history, setHistory] = useState(false);

	const signatures = doc.signatures ?? [];

	if (!doc.signable) return null;

	return (
		<div className="shrink-0 border-t border-white/[0.07] bg-black/40 backdrop-blur-xl">
			<div className="px-5 pt-3">
				<h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
					Signatures
				</h2>

				<div className="mb-2 flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2 text-[11.5px] leading-snug text-amber-200/80">
					<HugeiconsIcon icon={SquareLock02Icon} size={13} strokeWidth={2} className="mt-[1px] shrink-0" />
					<span>
						{doc.sealed
							? 'Everyone has signed. This document is locked and can no longer be edited.'
							: 'Once everyone has signed, this document locks and can no longer be edited.'}
					</span>
				</div>

				<div className="royal-scroll max-h-[136px] overflow-y-auto">
					{signatures.map((party) => (
						<div key={party.identifier} className="mb-1.5 flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2">
							<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white/60">
								<HugeiconsIcon icon={UserIcon} size={15} strokeWidth={1.9} />
							</span>

							<div className="min-w-0 flex-1">
								<div className="truncate text-[13.5px] font-bold text-white">
									{party.name}
									{party.number && <span className="ml-1 text-white/35">[{party.number}]</span>}
								</div>
								<div className="truncate text-[11px] text-white/35">
									{party.signed ? formatRelative(party.signedAt) : 'Party'}
								</div>
							</div>

							<span
								className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
									party.signed
										? 'bg-emerald-500/15 text-emerald-400'
										: 'bg-amber-500/15 text-amber-400'
								}`}
							>
								{party.signed ? 'Signed' : 'Pending'}
							</span>
						</div>
					))}
				</div>
			</div>

			<AnimatePresence>
				{history && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="overflow-hidden px-5"
					>
						<div className="rounded-xl bg-white/[0.04] px-3 py-2">
							{signatures.filter((p) => p.signed).length === 0 ? (
								<p className="text-[12px] text-white/35">Nothing signed yet.</p>
							) : (
								signatures
									.filter((p) => p.signed)
									.sort((a, b) => (a.signedAt ?? 0) - (b.signedAt ?? 0))
									.map((party) => (
										<div key={party.identifier} className="flex items-baseline justify-between py-1 text-[12px]">
											<span className="text-white/70">{party.name} signed</span>
											<span className="text-white/30">{formatRelative(party.signedAt)}</span>
										</div>
									))
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{error && <p className="px-5 pt-2 text-[12px] text-rose-400">{error}</p>}

			<div className="flex gap-2.5 px-5 py-3">
				<button onClick={() => setHistory((v) => !v)} className={GLASS_GHOST}>
					History
				</button>

				{doc.canSign ? (
					<button
						onClick={async () => {
							setBusy(true);
							const result = await sign(doc.id);
							setBusy(false);
							setError(result?.error ?? null);
						}}
						disabled={busy}
						className={GLASS_PRIMARY}
					>
						{busy ? 'Signing…' : 'Sign Document'}
					</button>
				) : doc.sealed ? (
					<span className={`${GLASS_GHOST} pointer-events-none text-emerald-400`}>
						<HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.4} /> Completed
					</span>
				) : (
					<span className={`${GLASS_GHOST} pointer-events-none text-white/40`}>Awaiting others</span>
				)}
			</div>
		</div>
	);
}

//#endregion

const TABS = [
	{ id: 'inbox', label: 'Inbox', icon: InboxIcon },
	{ id: 'notifications', label: 'Notifications', icon: Notification01Icon },
	{ id: 'templates', label: 'Templates', icon: File01Icon },
];

export default function DocumentsApp({ initial }) {
	const [open, setOpen] = useState(initial?.id ?? null);
	const [tab, setTab] = useState('inbox');

	const create = useDocumentsStore((s) => s.create);

	// A document deleted from under us (or a stale route) falls back to the list.
	const exists = useDocumentsStore((s) => open !== null && s.documents.some((doc) => doc.id === open));

	// Red dot on the tab while something is waiting on your signature.
	const waiting = useDocumentsStore((s) => s.documents.filter((doc) => doc.canSign).length);

	if (open !== null && exists) {
		return (
			<div className="flex h-full w-full flex-col" style={{ paddingBottom: 'var(--chrome-b)' }}>
				<DocumentScreen id={open} onBack={() => setOpen(null)} />
			</div>
		);
	}

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<Header
				title="Documents"
				actions={<IconButton icon={FileAddIcon} onClick={async () => setOpen(await create())} />}
			/>

			{tab === 'inbox' && <Inbox onOpen={setOpen} />}
			{tab === 'notifications' && <Notifications onOpen={setOpen} />}
			{tab === 'templates' && <Templates onOpen={setOpen} />}

			<nav className="mx-4 mb-1 flex shrink-0 items-center justify-around rounded-3xl bg-white/[0.05] p-1.5">
				{TABS.map((item) => {
					const active = tab === item.id;

					return (
						<button
							key={item.id}
							onClick={() => setTab(item.id)}
							className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition ${
								active ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70'
							}`}
						>
							<HugeiconsIcon icon={item.icon} size={19} strokeWidth={active ? 2 : 1.7} />
							<span className="text-[10px] font-medium">{item.label}</span>

							{item.id === 'notifications' && waiting > 0 && (
								<span className="absolute right-1/2 top-1 -mr-2.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
							)}
						</button>
					);
				})}
			</nav>
		</div>
	);
}
