import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Message01Icon,
	PlusSignIcon,
	SentIcon,
	Call02Icon,
	ArrowLeft01Icon,
	MoreVerticalIcon,
	SmileIcon,
	Mic02Icon,
	Album02Icon,
	UserGroupIcon,
	AddTeam02Icon,
	Cancel01Icon,
	PlayIcon,
	PauseIcon,
	Search01Icon,
	MessageNotification01Icon,
	MessageDone01Icon,
	Location01Icon,
} from '@hugeicons/core-free-icons';

import { Avatar } from './_shared';
import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import fetchNui from '../utils/fetchNui';
import { formatRelative, formatTime, formatDayDivider, startsNewDay } from '../utils/format';

import { EMOJI_GROUPS, rankRecents } from '../config/emoji';

/** Group the flat message table into one entry per conversation. */
function useThreads() {
	const messages = useDataStore((s) => s.messages);
	const number = useDataStore((s) => s.number);
	const contacts = useDataStore((s) => s.contacts);
	const groups = useDataStore((s) => s.groups);

	return useMemo(() => {
		const map = new Map();

		for (const message of messages) {
			// Group traffic is keyed by the group, whoever sent it.
			const key = message.receiver?.startsWith('group:')
				? message.receiver
				: message.sender === number
					? message.receiver
					: message.sender;

			if (!map.has(key)) map.set(key, { number: key, messages: [], unread: 0 });

			const thread = map.get(key);
			thread.messages.push(message);
			if (message.sender !== number && !message.read) thread.unread += 1;
		}

		// Groups show even before anyone has said anything.
		for (const group of groups) {
			const key = `group:${group.id}`;
			if (!map.has(key)) map.set(key, { number: key, messages: [], unread: 0 });
		}

		return [...map.values()]
			.map((thread) => {
				const group = thread.number.startsWith('group:')
					? groups.find((g) => `group:${g.id}` === thread.number)
					: null;

				return {
					...thread,
					group,
					name: group?.name || contacts.find((c) => c.number === thread.number)?.name || thread.number,
					avatar: contacts.find((c) => c.number === thread.number)?.avatar,
					last: thread.messages[thread.messages.length - 1],
				};
			})
			.sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));
	}, [messages, number, contacts, groups]);
}

//#region composer

function EmojiTray({ onPick }) {
	const usage = usePhoneStore((s) => s.settings.emojiUsage);
	const noteEmojiUse = usePhoneStore((s) => s.noteEmojiUse);

	const recents = useMemo(() => rankRecents(usage), [usage]);
	const [group, setGroup] = useState(recents.length ? 'recent' : EMOJI_GROUPS[0].id);

	const tabs = useMemo(
		() => (recents.length ? [{ id: 'recent', label: 'Recent' }, ...EMOJI_GROUPS] : EMOJI_GROUPS),
		[recents.length]
	);

	const shown = group === 'recent' ? recents : EMOJI_GROUPS.find((g) => g.id === group)?.emojis ?? [];

	const pick = (emoji) => {
		noteEmojiUse(emoji);
		onPick(emoji);
	};

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			className="overflow-hidden border-t border-white/[0.07]"
		>
			<div className="royal-scroll-x flex gap-1 overflow-x-auto px-3 pt-2">
				{tabs.map((item) => (
					<button
						key={item.id}
						onClick={() => setGroup(item.id)}
						className={`shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
							group === item.id ? 'bg-white/[0.14] text-white' : 'text-white/40 hover:text-white/70'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			<div className="royal-scroll grid max-h-[152px] grid-cols-8 gap-1 overflow-y-auto px-3 py-2">
				{shown.map((emoji) => (
					<button
						key={emoji}
						onClick={() => pick(emoji)}
						className="grid h-8 place-items-center rounded-lg text-[19px] transition hover:bg-white/10"
					>
						{emoji}
					</button>
				))}
			</div>
		</motion.div>
	);
}

/** Scrollable grid with a preview + confirm step, rather than a blind strip. */
function GalleryTray({ onPick }) {
	const photos = useDataStore((s) => s.photos);
	const openApp = usePhoneStore((s) => s.openApp);
	const [chosen, setChosen] = useState(null);

	const photo = photos[chosen];

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			className="overflow-hidden border-t border-white/[0.07]"
		>
			<div className="flex items-center justify-between px-4 pt-2.5">
				<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">Gallery</span>
				<button
					onClick={() => openApp('camera')}
					className="text-[11.5px] font-medium text-sky-400 transition hover:text-sky-300"
				>
					Take photo
				</button>
			</div>

			{photos.length === 0 ? (
				<p className="px-4 py-6 text-center text-[13px] text-white/35">
					No photos yet — take one with the Camera app.
				</p>
			) : (
				<>
					<div className="royal-scroll grid max-h-[164px] grid-cols-4 gap-1.5 overflow-y-auto px-3 py-2.5">
						{photos.map((item, index) => (
							<button
								key={`${item.takenAt}-${index}`}
								onClick={() => setChosen(chosen === index ? null : index)}
								className={`relative aspect-square overflow-hidden rounded-xl bg-white/[0.06] ring-2 transition ${
									chosen === index ? 'ring-sky-500' : 'ring-transparent'
								}`}
							>
								{item.url ? (
									<img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" />
								) : (
									<span className="grid h-full place-items-center text-[10px] text-white/30">IMG</span>
								)}
							</button>
						))}
					</div>

					<AnimatePresence>
						{photo && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: 'auto', opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								className="overflow-hidden px-3 pb-2"
							>
								<button
									onClick={() => onPick(photo)}
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-[13.5px] font-bold text-white"
								>
									<HugeiconsIcon icon={SentIcon} size={15} strokeWidth={2.2} /> Send photo
								</button>
							</motion.div>
						)}
					</AnimatePresence>
				</>
			)}
		</motion.div>
	);
}

/** Blob → data URL, so a recording can cross the NUI boundary as JSON. */
const blobToDataUrl = (blob) =>
	new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(blob);
	});

/**
 * What the + reveals: round buttons in the same shape as the mic, floated over
 * the field rather than shoving the composer down.
 */
const ATTACHMENTS = [
	{ id: 'gallery', label: 'Photo', icon: Album02Icon },
	{ id: 'location', label: 'Share location', icon: Location01Icon },
];

/** Mirrors Config.VoiceMaxSeconds; the recorder stops itself here. */
const MAX_VOICE_SECONDS = 20;

function Composer({ onSend }) {
	const [draft, setDraft] = useState('');
	const [tray, setTray] = useState(null);
	const [recording, setRecording] = useState(null);
	const inputRef = useRef(null);
	const recorderRef = useRef(null);
	const chunksRef = useRef(null);

	// Hold the mic to record; the elapsed time drives the pill.
	const [heldFor, setHeldFor] = useState(0);

	// Clips are stored with the message, so the length limit is what keeps the
	// messages table from filling up with audio. The recorder stops itself.
	useEffect(() => {
		if (!recording) return;

		const id = setInterval(() => {
			const elapsed = Math.round((Date.now() - recording) / 1000);
			setHeldFor(elapsed);
			if (elapsed >= MAX_VOICE_SECONDS) stopRecording();
		}, 250);

		return () => clearInterval(id);
	}, [recording]);

	const submit = (event) => {
		event?.preventDefault();
		const text = draft.trim();
		if (!text) return;

		onSend(text);
		setDraft('');
	};

	const sendLocation = async () => {
		setTray(null);

		const place = await fetchNui('shareLocation', {}, {
			label: 'Legion Square',
			x: 195.2,
			y: -933.8,
		});

		if (!place) return;
		onSend(`📍 ${place.label}`, { kind: 'location', location: place });
	};

	/**
	 * Recording, with a capture path and a fallback.
	 *
	 * CEF exposes `getUserMedia` only when the client was launched with media
	 * access enabled, which is not something a resource can rely on. So: try to
	 * record properly, and if the mic is unavailable fall back to the placeholder
	 * bubble and let a voice resource fill it in through `voiceMessage`. Either
	 * way the message lands — the difference is whether it has audio attached.
	 */
	const startRecording = async () => {
		setHeldFor(0);
		setRecording(Date.now());

		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			const chunks = [];

			recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
			recorder.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				chunksRef.current = chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null;
			};

			recorder.start();
			recorderRef.current = recorder;
		} catch {
			// No microphone. The placeholder path covers it.
			recorderRef.current = null;
		}
	};

	const stopRecording = async () => {
		if (!recording) return;

		const seconds = Math.max(1, Math.round((Date.now() - recording) / 1000));
		setRecording(null);

		const recorder = recorderRef.current;
		recorderRef.current = null;

		let media = null;

		if (recorder && recorder.state !== 'inactive') {
			// Wait for the last chunk before reading it back.
			await new Promise((resolve) => {
				recorder.addEventListener('stop', resolve, { once: true });
				recorder.stop();
			});

			const blob = chunksRef.current;
			chunksRef.current = null;

			if (blob) {
				const uploaded = await fetchNui('uploadVoice', {
					data: await blobToDataUrl(blob),
					seconds,
				}, null);

				media = uploaded?.url ?? null;
			}
		}

		// Fires either way, so a voice resource can still attach a clip when the
		// browser could not record one itself.
		fetchNui('voiceMessage', { seconds, media });
		onSend(`Voice message · ${seconds}s`, { kind: 'voice', seconds, media });
	};

	return (
		<div className="shrink-0">
			<AnimatePresence>
				{tray === 'emoji' && (
					<EmojiTray
						key="emoji"
						onPick={(emoji) => {
							setDraft((v) => v + emoji);
							inputRef.current?.focus();
						}}
					/>
				)}
				{tray === 'gallery' && (
					<GalleryTray
						key="gallery"
						onPick={(photo) => {
							onSend('Photo', { kind: 'image', media: photo.url });
							setTray(null);
						}}
					/>
				)}
			</AnimatePresence>

			{/* The + row sits directly over the field rather than pushing it down,
			    so the composer never moves under the thumb. */}
			<div className="relative">
				<AnimatePresence>
					{tray === 'menu' && (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 8 }}
							transition={{ type: 'spring', stiffness: 500, damping: 34 }}
							className="absolute inset-x-0 bottom-full z-10 flex items-center gap-2 px-3 pb-2"
						>
							{ATTACHMENTS.map((item) => (
								<button
									key={item.id}
									type="button"
									title={item.label}
									onClick={() => (item.id === 'location' ? sendLocation() : setTray(item.id))}
									className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white shadow-lg shadow-black/40 transition hover:bg-white/[0.16]"
								>
									<HugeiconsIcon icon={item.icon} size={18} strokeWidth={2} />
								</button>
							))}
						</motion.div>
					)}
				</AnimatePresence>

				<form onSubmit={submit} className="flex items-center gap-2 px-3 py-3">
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						animate={{ rotate: tray === 'menu' ? 45 : 0 }}
						transition={{ type: 'spring', stiffness: 500, damping: 30 }}
						onClick={() => setTray(tray === 'menu' ? null : 'menu')}
						className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
							tray ? 'bg-white text-black' : 'bg-white/[0.09] text-white'
						}`}
					>
						<HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
					</motion.button>

					<div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2.5">
						{recording ? (
							<span className="flex flex-1 items-center gap-2 text-[13.5px] text-rose-400">
								<motion.span
									animate={{ opacity: [1, 0.25, 1] }}
									transition={{ duration: 1, repeat: Infinity }}
									className="h-2 w-2 rounded-full bg-rose-500"
								/>
								Recording · {heldFor}s
							</span>
						) : (
							<input
								ref={inputRef}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) submit(e);
								}}
								placeholder="Message"
								className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
							/>
						)}

						{/* Emoji and send live inside the pill. Send only appears once
						    there is something to send, so the field keeps its width. */}
						{draft.trim() ? (
							<motion.button
								type="submit"
								whileTap={{ scale: 0.88 }}
								className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500 text-white"
							>
								<HugeiconsIcon icon={SentIcon} size={15} strokeWidth={2.2} />
							</motion.button>
						) : (
							<button
								type="button"
								onClick={() => setTray(tray === 'emoji' ? null : 'emoji')}
								className={`shrink-0 transition ${
									tray === 'emoji' ? 'text-amber-300' : 'text-white/40 hover:text-white'
								}`}
							>
								<HugeiconsIcon icon={SmileIcon} size={19} strokeWidth={1.9} />
							</button>
						)}
					</div>

					{/* Always here, whatever the field contains — the mic moving in and
					    out as you type made it impossible to aim for. */}
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onPointerDown={startRecording}
						onPointerUp={stopRecording}
						onPointerLeave={() => recording && stopRecording()}
						className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
							recording ? 'bg-rose-600 text-white' : 'bg-white/[0.09] text-white'
						}`}
					>
						<HugeiconsIcon icon={Mic02Icon} size={18} strokeWidth={2} />
					</motion.button>
				</form>
			</div>
		</div>
	);
}

//#endregion

//#region thread

/**
 * A playable voice note.
 *
 * `media` is a URL to the recorded clip. The waveform doubles as a progress bar
 * and a scrub target, and playback is driven by a plain `Audio` element rather
 * than the shared sound helper — that one is for short UI blips and has no
 * notion of position, duration or stopping.
 *
 * Notes with no `media` are the pre-recording placeholders: they still show
 * their length, but say so rather than pretending to play.
 */
function VoiceNote({ message }) {
	const audio = useRef(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);

	const volume = usePhoneStore((s) => s.settings.volume);
	const sounds = usePhoneStore((s) => s.settings.sounds);

	const bars = useMemo(
		// Stable per message, so a note does not reshuffle its own waveform on
		// every render. Deterministic from the id rather than random.
		() =>
			Array.from({ length: 22 }, (_, index) => {
				const seed = Math.sin((Number(message.id) || 1) * 12.9898 + index * 78.233) * 43758.5453;
				return 5 + Math.abs(seed - Math.floor(seed)) * 13;
			}),
		[message.id]
	);

	useEffect(() => () => audio.current?.pause(), []);

	const toggle = () => {
		if (!message.media) return;

		if (!audio.current) {
			audio.current = new Audio(message.media);

			audio.current.addEventListener('timeupdate', () => {
				const element = audio.current;
				if (!element?.duration) return;
				setProgress(element.currentTime / element.duration);
			});

			audio.current.addEventListener('ended', () => {
				setPlaying(false);
				setProgress(0);
			});
		}

		audio.current.volume = sounds ? volume / 100 : 0;

		if (playing) {
			audio.current.pause();
			setPlaying(false);
			return;
		}

		audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
	};

	const seek = (event) => {
		const element = audio.current;
		if (!element?.duration) return;

		const box = event.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));

		element.currentTime = ratio * element.duration;
		setProgress(ratio);
	};

	const played = Math.round(progress * bars.length);

	return (
		<div className="flex items-center gap-2.5 py-0.5">
			<button
				onClick={toggle}
				disabled={!message.media}
				className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 transition hover:bg-white/30 disabled:opacity-50"
			>
				<HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={14} strokeWidth={2.4} />
			</button>

			<span onClick={message.media ? seek : undefined} className={message.media ? 'cursor-pointer' : ''}>
				<span className="flex items-end gap-[2px]">
					{bars.map((height, index) => (
						<span
							key={index}
							className={`w-[2px] rounded-full transition-colors ${
								index < played ? 'bg-white' : 'bg-white/45'
							}`}
							style={{ height }}
						/>
					))}
				</span>
			</span>

			<span className="text-[11px] tabular-nums text-white/70">
				{message.media ? `${message.seconds ?? 0}s` : `${message.seconds ?? 0}s ·`}
			</span>
		</div>
	);
}

function Bubble({ message, mine, senderName }) {
	return (
		<div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
			<div
				className={`max-w-[78%] rounded-2xl text-[14px] leading-snug ${
					mine ? 'rounded-br-md bg-sky-600 text-white' : 'rounded-bl-md bg-white/[0.09] text-white'
				} ${message.pending ? 'opacity-60' : ''} ${message.kind === 'image' ? 'p-1' : 'px-3.5 py-2'}`}
			>
				{senderName && (
					<div className="px-1 pb-0.5 text-[11px] font-bold text-emerald-400">{senderName}</div>
				)}

				{message.kind === 'image' ? (
					<>
						{message.media ? (
							<img src={message.media} alt="" className="max-h-[200px] rounded-xl object-cover" />
						) : (
							<div className="grid h-28 w-40 place-items-center rounded-xl bg-black/40 text-[11px] text-white/40">
								Photo
							</div>
						)}
						<span className="block px-2 pb-1 pt-1 text-right text-[10px] text-white/60">
							{formatTime(message.createdAt)}
						</span>
					</>
				) : message.kind === 'voice' ? (
					<VoiceNote message={message} />
				) : message.kind === 'location' ? (
					<button
						onClick={() => message.location && fetchNui('setWaypoint', message.location)}
						className="flex w-full min-w-0 items-center gap-2.5 py-0.5 text-left"
					>
						<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/25 text-emerald-300">
							<HugeiconsIcon icon={Location01Icon} size={17} strokeWidth={2} />
						</span>

						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium">{message.location?.label ?? 'Location'}</span>
							<span className={`block text-[11px] ${mine ? 'text-white/60' : 'text-white/40'}`}>
								Tap to set a waypoint
							</span>
						</span>
					</button>
				) : (
					<>
						<p className="whitespace-pre-wrap break-words">{message.content}</p>
						<span className={`mt-0.5 block text-right text-[10px] ${mine ? 'text-white/60' : 'text-white/35'}`}>
							{formatTime(message.createdAt)}
						</span>
					</>
				)}
			</div>
		</div>
	);
}

function DayDivider({ at }) {
	return (
		<div className="flex justify-center py-2">
			<span className="rounded-md bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
				{formatDayDivider(at)}
			</span>
		</div>
	);
}

/**
 * Group admin, folded into the thread's overflow menu. The owner can rename,
 * invite, kick and delete; everyone else can only leave.
 */
function GroupPanel({ group, onLeave }) {
	const {
		contacts, photos, nameFor, ownsGroup,
		inviteToGroup, kickFromGroup, renameGroup, removeGroup, setGroupAvatar,
	} = useDataStore();

	const owner = ownsGroup(group);
	const [name, setName] = useState(group.name);
	const [invite, setInvite] = useState('');
	const [error, setError] = useState(null);
	const [picking, setPicking] = useState(false);

	const candidates = contacts.filter((c) => !group.members.includes(c.number));

	const say = (result) => {
		setError(result?.error ?? null);
		return !result?.error;
	};

	return (
		<div className="px-4 py-3">
			{owner && (
				<>
					<div className="mb-3 flex items-center gap-3">
						<button
							onClick={() => setPicking((v) => !v)}
							title="Group picture"
							className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.09] text-white/60 transition hover:bg-white/[0.14]"
						>
							{group.avatar ? (
								<img src={group.avatar} alt="" className="h-full w-full object-cover" />
							) : (
								<HugeiconsIcon icon={UserGroupIcon} size={20} strokeWidth={1.9} />
							)}
						</button>

						<div className="flex min-w-0 flex-1 gap-2">
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Group name"
								className="min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30"
							/>
							<button
								onClick={() => say(renameGroup(group.id, name))}
								disabled={name.trim() === group.name}
								className="shrink-0 rounded-xl bg-white px-3 py-2 text-[12.5px] font-bold text-black disabled:opacity-30"
							>
								Save
							</button>
						</div>
					</div>

					<AnimatePresence>
						{picking && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: 'auto', opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								className="mb-3 overflow-hidden"
							>
								{photos.length === 0 ? (
									<p className="text-[12.5px] text-white/35">
										No photos yet — take one with the Camera app.
									</p>
								) : (
									<div className="royal-scroll-x flex gap-2 overflow-x-auto pb-1">
										{group.avatar && (
											<button
												onClick={() => {
													setGroupAvatar(group.id, null);
													setPicking(false);
												}}
												className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[11px] text-white/50"
											>
												Clear
											</button>
										)}

										{photos.map((photo, index) => (
											<button
												key={`${photo.takenAt}-${index}`}
												onClick={() => {
													setGroupAvatar(group.id, photo.url);
													setPicking(false);
												}}
												className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
											>
												{photo.url && (
													<img src={photo.url} alt="" className="h-full w-full object-cover" />
												)}
											</button>
										))}
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</>
			)}

			<div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">
				{group.members.length} members
			</div>

			<div className="royal-scroll mb-3 max-h-[132px] space-y-1 overflow-y-auto">
				{group.members.map((member) => (
					<div key={member} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
						<span className="min-w-0 flex-1 truncate text-[13.5px] text-white">{nameFor(member)}</span>

						{owner && (
							<button
								onClick={() => kickFromGroup(group.id, member)}
								title="Remove from group"
								className="shrink-0 rounded-md bg-rose-500/15 px-2 py-1 text-[11.5px] font-medium text-rose-400"
							>
								Kick
							</button>
						)}
					</div>
				))}
			</div>

			{owner && (
				<div className="mb-3">
					<div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">
						Invite
					</div>

					{candidates.length > 0 && (
						<div className="royal-scroll-x mb-2 flex gap-1.5 overflow-x-auto pb-1">
							{candidates.map((contact) => (
								<button
									key={contact.id}
									onClick={async () => say(await inviteToGroup(group.id, contact.number))}
									className="shrink-0 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[12px] text-white transition hover:bg-white/[0.14]"
								>
									+ {contact.name}
								</button>
							))}
						</div>
					)}

					<div className="flex gap-2">
						<input
							value={invite}
							onChange={(e) => setInvite(e.target.value)}
							placeholder="Number"
							className="min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30"
						/>
						<button
							onClick={async () => {
								if (await say(await inviteToGroup(group.id, invite))) setInvite('');
							}}
							className="shrink-0 rounded-xl bg-white/[0.12] px-3 py-2 text-[12.5px] font-bold text-white"
						>
							Add
						</button>
					</div>
				</div>
			)}

			{error && <p className="mb-2 text-[12px] text-rose-400">{error}</p>}

			<button
				onClick={() => {
					removeGroup(group.id);
					onLeave?.();
				}}
				className="w-full rounded-xl bg-rose-500/15 py-2 text-[13px] font-medium text-rose-400"
			>
				{owner ? 'Delete group' : 'Leave group'}
			</button>
		</div>
	);
}

function Thread({ thread, onBack, showBack, attach, onAttachDone }) {
	const number = useDataStore((s) => s.number);
	const sendMessage = useDataStore((s) => s.sendMessage);
	const markRead = useDataStore((s) => s.markRead);
	const nameFor = useDataStore((s) => s.nameFor);
	const setCall = usePhoneStore((s) => s.setCall);

	const [menu, setMenu] = useState(false);
	const bottom = useRef(null);

	useEffect(() => {
		markRead(thread.number);
	}, [thread.number]);

	useEffect(() => {
		bottom.current?.scrollIntoView({ block: 'end' });
	}, [thread.messages.length]);

	const call = () => {
		if (thread.group) return;

		setCall({ number: thread.number, name: thread.name, direction: 'out', state: 'dialing' });
		fetchNui('call', { number: thread.number, name: thread.name });
	};

	return (
		<div
			className="flex h-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4 py-2.5">
				{showBack && (
					<button
						onClick={onBack}
						className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2} />
					</button>
				)}

				{thread.group ? (
					<span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.09] text-white/70">
						{thread.group.avatar ? (
							<img src={thread.group.avatar} alt="" className="h-full w-full object-cover" />
						) : (
							<HugeiconsIcon icon={UserGroupIcon} size={17} strokeWidth={1.9} />
						)}
					</span>
				) : (
					<Avatar name={thread.name} avatar={thread.avatar} size="h-9 w-9" />
				)}

				<div className="min-w-0 flex-1">
					<div className="truncate text-[15px] font-bold text-white">{thread.name}</div>
					{thread.group && (
						<div className="truncate text-[11.5px] text-white/40">{thread.group.members.length} members</div>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-1 text-white/70">
					{!thread.group && (
						<button
							onClick={call}
							className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 hover:text-white"
						>
							<HugeiconsIcon icon={Call02Icon} size={18} strokeWidth={1.9} />
						</button>
					)}
					<button
						onClick={() => setMenu((v) => !v)}
						className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 hover:text-white"
					>
						<HugeiconsIcon icon={MoreVerticalIcon} size={18} strokeWidth={1.9} />
					</button>
				</div>
			</header>

			<AnimatePresence>
				{menu && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="shrink-0 overflow-hidden border-b border-white/[0.07] bg-white/[0.03]"
					>
						{thread.group ? (
							<GroupPanel group={thread.group} onLeave={onBack} />
						) : (
							<div className="px-4 py-2.5 text-[12.5px] text-white/45">{thread.number}</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			<div className="royal-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-4 py-3">
				{thread.messages.map((message, index) => {
					const previous = thread.messages[index - 1];
					const mine = message.sender === number;

					return (
						<React.Fragment key={message.id}>
							{startsNewDay(message.createdAt, previous?.createdAt) && (
								<DayDivider at={message.createdAt} />
							)}

							<Bubble
								message={message}
								mine={mine}
								senderName={thread.group && !mine ? nameFor(message.sender) : null}
							/>
						</React.Fragment>
					);
				})}
				<div ref={bottom} />
			</div>

			{/* Photo carried over from the Gallery, waiting for a recipient. */}
			<AnimatePresence>
				{attach && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="shrink-0 overflow-hidden border-t border-white/[0.07]"
					>
						<div className="flex items-center gap-3 px-4 py-2.5">
							<img src={attach} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />

							<span className="min-w-0 flex-1 truncate text-[12.5px] text-white/50">
								Photo ready to send
							</span>

							<button
								onClick={() => {
									sendMessage(thread.number, 'Photo', { kind: 'image', media: attach });
									onAttachDone?.();
								}}
								className="shrink-0 rounded-xl bg-sky-500 px-3 py-1.5 text-[12.5px] font-bold text-white"
							>
								Send
							</button>

							<button
								onClick={onAttachDone}
								className="shrink-0 text-white/35 transition hover:text-white/70"
							>
								<HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2.2} />
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<Composer onSend={(text, extra) => sendMessage(thread.number, text, extra)} />
		</div>
	);
}

//#endregion

//#region new conversation / group

function NewThread({ onClose, onOpen }) {
	const { contacts, createGroup } = useDataStore();

	const [mode, setMode] = useState('direct');
	const [number, setNumber] = useState('');
	const [groupName, setGroupName] = useState('');
	const [picked, setPicked] = useState([]);
	const [error, setError] = useState(null);

	const toggle = (value) =>
		setPicked((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));

	const submit = async (event) => {
		event.preventDefault();

		if (mode === 'direct') {
			if (!number.trim()) return setError('Enter a number.');

			onOpen(number.trim());
			return onClose();
		}

		setError(null);

		const result = await createGroup(groupName, picked);
		if (result?.error) return setError(result.error);

		onOpen(`group:${result.group.id}`);
		onClose();
	};

	return (
		<form onSubmit={submit} className="mb-4 rounded-2xl bg-white/[0.05] p-4">
			<div className="mb-3 flex gap-1 rounded-xl bg-black/30 p-1">
				{[
					{ id: 'direct', label: 'Direct' },
					{ id: 'group', label: 'Group' },
				].map((option) => (
					<button
						key={option.id}
						type="button"
						onClick={() => setMode(option.id)}
						className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition ${
							mode === option.id ? 'bg-white text-black' : 'text-white/50'
						}`}
					>
						{option.label}
					</button>
				))}
			</div>

			{mode === 'direct' ? (
				<input
					value={number}
					onChange={(e) => setNumber(e.target.value)}
					placeholder="Number"
					autoFocus
					className="w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
				/>
			) : (
				<>
					<input
						value={groupName}
						onChange={(e) => setGroupName(e.target.value)}
						placeholder="Group name"
						autoFocus
						className="mb-2 w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
					/>

					<div className="royal-scroll mb-1 max-h-[150px] overflow-y-auto rounded-xl bg-black/20 p-1">
						{contacts.length === 0 ? (
							<p className="px-3 py-3 text-[12.5px] text-white/35">No contacts to add.</p>
						) : (
							contacts.map((contact) => (
								<button
									key={contact.id}
									type="button"
									onClick={() => toggle(contact.number)}
									className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
								>
									<span
										className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
											picked.includes(contact.number)
												? 'border-sky-500 bg-sky-500 text-white'
												: 'border-white/25'
										}`}
									>
										{picked.includes(contact.number) && (
											<HugeiconsIcon icon={PlusSignIcon} size={10} strokeWidth={3} />
										)}
									</span>
									<span className="min-w-0 flex-1 truncate text-[13.5px] text-white">{contact.name}</span>
								</button>
							))
						)}
					</div>

					<p className="mb-2 px-1 text-[11.5px] text-white/30">{picked.length} selected</p>
				</>
			)}

			{error && <p className="mb-2 px-1 text-[12px] text-rose-400">{error}</p>}

			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={onClose}
					className="flex-1 rounded-xl bg-white/[0.07] py-2.5 text-[13.5px] font-medium text-white/70"
				>
					Cancel
				</button>
				<button type="submit" className="flex-1 rounded-xl bg-white py-2.5 text-[13.5px] font-bold text-black">
					{mode === 'direct' ? 'Open' : 'Create'}
				</button>
			</div>
		</form>
	);
}

//#endregion

/**
 * Bottom navigation, mirroring the Phone app's — same four slots, same
 * treatment. "Calls" is a shortcut out to the dialer, the way the dialer's
 * "Messages" tab is a shortcut in here.
 */
const TABS = [
	{ id: 'all', label: 'All', icon: Message01Icon },
	{ id: 'unread', label: 'Unread', icon: MessageNotification01Icon },
	{ id: 'groups', label: 'Groups', icon: UserGroupIcon },
	{ id: 'calls', label: 'Calls', icon: Call02Icon },
];

const EMPTY_LABEL = {
	all: 'No messages',
	unread: 'Nothing unread',
	groups: 'No group chats',
};

export default function MessagesApp({ initial }) {
	const threads = useThreads();
	const expanded = usePhoneStore((s) => s.expanded);

	const markRead = useDataStore((s) => s.markRead);
	const openApp = usePhoneStore((s) => s.openApp);

	const [selected, setSelected] = useState(initial?.number ?? null);
	const [composing, setComposing] = useState(false);
	const [query, setQuery] = useState('');
	const [tab, setTab] = useState('all');
	/** Photo handed over by the Gallery's "Send in a message". */
	const [attach, setAttach] = useState(initial?.attach ?? null);

	// The wide layout keeps a thread on screen at all times.
	useEffect(() => {
		if (expanded && !selected && threads.length) setSelected(threads[0].number);
	}, [expanded, threads.length]);

	const contacts = useDataStore((s) => s.contacts);

	/**
	 * A conversation that does not exist yet is still a conversation you can open.
	 *
	 * `useThreads` only builds threads out of messages that already exist, so
	 * texting a contact you have never texted — the Phone app's message button, a
	 * number typed into the composer — used to select a thread that was not there
	 * and silently drop back to the list. Synthesising an empty one is what makes
	 * that first message possible.
	 */
	const thread = useMemo(() => {
		if (!selected) return null;

		const existing = threads.find((t) => t.number === selected);
		if (existing) return existing;

		// Groups are always real rows; only direct numbers get a blank thread.
		if (selected.startsWith('group:')) return null;

		const contact = contacts.find((c) => c.number === selected);

		return {
			number: selected,
			messages: [],
			unread: 0,
			group: null,
			name: contact?.name || selected,
			avatar: contact?.avatar,
			last: null,
		};
	}, [threads, selected, contacts]);

	const preview = (item) => {
		const last = item.last;
		if (!last) return item.group ? 'No messages yet' : '';
		if (last.kind === 'image') return '📷 Photo';
		if (last.kind === 'voice') return `🎙 Voice · ${last.seconds ?? 0}s`;
		return last.content;
	};

	const unreadCount = threads.reduce((sum, item) => sum + (item.unread > 0 ? 1 : 0), 0);

	const shownThreads = useMemo(() => {
		const needle = query.trim().toLowerCase();

		return threads.filter((item) => {
			if (tab === 'unread' && !item.unread) return false;
			if (tab === 'groups' && !item.group) return false;
			if (!needle) return true;

			return (
				item.name.toLowerCase().includes(needle) ||
				String(item.number).toLowerCase().includes(needle)
			);
		});
	}, [threads, query, tab]);

	// Laid out like the Phone app's Contacts: a search field, then plain rows
	// with round avatars — no card wrapper.
	const list = (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-1 px-5 pb-3 pt-1">
				<h1 className="flex-1 truncate text-[26px] font-bold leading-tight tracking-tight text-white">
					Messages
				</h1>

				<button
					onClick={() => threads.forEach((item) => markRead(item.number))}
					disabled={unreadCount === 0}
					className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/20"
				>
					<HugeiconsIcon icon={MessageDone01Icon} size={18} strokeWidth={1.9} />
				</button>

				<button
					onClick={() => setComposing((v) => !v)}
					className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
				>
					<HugeiconsIcon icon={composing ? Cancel01Icon : AddTeam02Icon} size={18} strokeWidth={1.9} />
				</button>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5">
				<div className="mb-4 flex items-center gap-2 rounded-2xl bg-white/[0.07] px-4 py-3">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search"
						className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
					/>
					<HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={2} className="shrink-0 text-white/45" />
				</div>

				<AnimatePresence>
					{composing && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							className="overflow-hidden"
						>
							<NewThread onClose={() => setComposing(false)} onOpen={setSelected} />
						</motion.div>
					)}
				</AnimatePresence>

				{shownThreads.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
						<HugeiconsIcon icon={Message01Icon} size={34} strokeWidth={1.4} className="text-white/30" />
						<span className="text-[14px] font-medium text-white/45">
							{query ? 'No matches' : EMPTY_LABEL[tab]}
						</span>
					</div>
				) : (
					shownThreads.map((item) => (
						<button
							key={item.number}
							// Negative margin so the hover fill extends past the list's own
							// padding: without it the highlight stops short of the text on
							// both sides and reads as misaligned.
							onClick={() => setSelected(item.number)}
							className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.04] ${
								selected === item.number && expanded ? 'bg-white/[0.05]' : ''
							}`}
						>
							{item.group ? (
								<span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.09] text-white/70">
									{item.group.avatar ? (
										<img src={item.group.avatar} alt="" className="h-full w-full object-cover" />
									) : (
										<HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.9} />
									)}
								</span>
							) : (
								<Avatar name={item.name} avatar={item.avatar} />
							)}

							<div className="min-w-0 flex-1">
								<div className="truncate text-[15px] font-bold text-white">{item.name}</div>
								<div className="truncate text-[13px] text-white/40">{preview(item)}</div>
							</div>

							<div className="flex shrink-0 flex-col items-end gap-1">
								<span className="text-[11.5px] text-white/30">{formatRelative(item.last?.createdAt)}</span>
								{item.unread > 0 && (
									<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
										{item.unread}
									</span>
								)}
							</div>
						</button>
					))
				)}
			</div>

			<nav className="mx-4 mb-1 flex shrink-0 items-center justify-around rounded-3xl bg-white/[0.05] p-1.5">
				{TABS.map((item) => {
					const active = tab === item.id;

					return (
						<button
							key={item.id}
							onClick={() => (item.id === 'calls' ? openApp('dialer') : setTab(item.id))}
							className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition ${
								active ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70'
							}`}
						>
							<HugeiconsIcon icon={item.icon} size={19} strokeWidth={active ? 2 : 1.7} />
							<span className="text-[10px] font-medium">{item.label}</span>

							{item.id === 'unread' && unreadCount > 0 && (
								<span className="absolute right-1/2 top-1 -mr-2.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
							)}
						</button>
					);
				})}
			</nav>
		</div>
	);

	if (expanded) {
		return (
			<div className="flex h-full">
				<div className="w-[340px] shrink-0 border-r border-white/[0.07]">{list}</div>
				<div className="min-w-0 flex-1">
					{thread ? (
						<Thread thread={thread} showBack={false} attach={attach} onAttachDone={() => setAttach(null)} />
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
							<HugeiconsIcon icon={Message01Icon} size={34} strokeWidth={1.4} className="text-white/30" />
							<span className="text-[14px] font-medium text-white/45">Pick a conversation</span>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Opening a thread swaps instantly. The slide-in used to race the call UI
	// when a call arrived mid-transition, leaving a half-slid panel on screen.
	return (
		<div className="relative h-full overflow-hidden">
			{thread ? (
				<Thread
					thread={thread}
					showBack
					onBack={() => setSelected(null)}
					attach={attach}
					onAttachDone={() => setAttach(null)}
				/>
			) : (
				list
			)}
		</div>
	);
}
