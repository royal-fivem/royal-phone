import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon, Search01Icon, SaleTag01Icon, Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons';

import { Face, Empty, inputClass } from './parts';
import useDataStore from '../../state/dataStore';
import useLifeinvaderStore from '../../state/lifeinvaderStore';
import { formatRelative, formatMoney } from '../../utils/format';

function NewListing({ onClose }) {
	const list = useLifeinvaderStore((s) => s.list);
	const photos = useDataStore((s) => s.photos);

	const [title, setTitle] = useState('');
	const [price, setPrice] = useState('');
	const [body, setBody] = useState('');
	const [media, setMedia] = useState(null);

	const submit = async (event) => {
		event.preventDefault();
		if (!title.trim()) return;

		await list({ title, price, body, media });
		onClose();
	};

	return (
		<motion.form
			onSubmit={submit}
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			className="mb-3 overflow-hidden rounded-2xl bg-white/[0.05] p-3"
		>
			<input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="What are you selling?"
				autoFocus
				className={`${inputClass} mb-2`}
			/>
			<input
				value={price}
				onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
				placeholder="Price"
				inputMode="numeric"
				className={`${inputClass} mb-2`}
			/>
			<textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder="Details"
				rows={2}
				className={`${inputClass} mb-2 resize-none font-normal`}
			/>

			{photos.length > 0 && (
				<div className="royal-scroll mb-2 flex gap-2 overflow-x-auto">
					{photos.map((photo, index) => (
						<button
							key={`${photo.takenAt}-${index}`}
							type="button"
							onClick={() => setMedia(media === photo.url ? null : photo.url)}
							className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ring-2 transition ${
								media === photo.url ? 'ring-sky-500' : 'ring-transparent'
							}`}
						>
							{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
						</button>
					))}
				</div>
			)}

			<div className="flex gap-2">
				<button
					type="button"
					onClick={onClose}
					className="flex-1 rounded-xl bg-white/[0.07] py-2.5 text-[13.5px] font-medium text-white/70"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!title.trim()}
					className="flex-1 rounded-xl bg-sky-500 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-30"
				>
					List it
				</button>
			</div>
		</motion.form>
	);
}

export default function Marketplace() {
	const listings = useLifeinvaderStore((s) => s.listings);
	const removeListing = useLifeinvaderStore((s) => s.removeListing);
	const me = useLifeinvaderStore((s) => s.me());

	const [query, setQuery] = useState('');
	const [adding, setAdding] = useState(false);

	const shown = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return listings;

		return listings.filter(
			(l) =>
				l.title.toLowerCase().includes(needle) ||
				l.body.toLowerCase().includes(needle) ||
				l.seller.toLowerCase().includes(needle)
		);
	}, [listings, query]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-1">
				<h1 className="flex-1 text-[20px] font-bold tracking-tight text-white">Marketplace</h1>
				<button
					onClick={() => setAdding((v) => !v)}
					className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.09] text-white transition hover:bg-white/[0.16]"
				>
					<HugeiconsIcon icon={adding ? Cancel01Icon : PlusSignIcon} size={17} strokeWidth={2.2} />
				</button>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-3">
				<div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 py-2.5">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search..."
						className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/35"
					/>
					<HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} className="shrink-0 text-white/45" />
				</div>

				<AnimatePresence>{adding && <NewListing onClose={() => setAdding(false)} />}</AnimatePresence>

				{shown.length === 0 ? (
					<Empty icon={SaleTag01Icon} label="Nothing for sale" hint="Tap + to list something." />
				) : (
					<div className="grid grid-cols-2 gap-3">
						{shown.map((listing) => (
							<div key={listing.id} className="overflow-hidden">
								<div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/[0.06]">
									{listing.media ? (
										<img src={listing.media} alt="" className="h-full w-full object-cover" loading="lazy" />
									) : (
										<span className="grid h-full place-items-center text-white/20">
											<HugeiconsIcon icon={SaleTag01Icon} size={22} strokeWidth={1.4} />
										</span>
									)}

									<span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5">
										<Face name={listing.seller} size="h-4 w-4" text="text-[8px]" />
										<span className="truncate text-[10.5px] font-bold text-white">{listing.seller}</span>
									</span>
								</div>

								<h3 className="mt-1.5 truncate text-[14px] font-bold text-white">{listing.title}</h3>

								<div className="flex items-baseline gap-2">
									<span className="text-[13.5px] font-bold text-white">
										{formatMoney(listing.price)}
									</span>
									<span className="text-[11px] text-white/30">{formatRelative(listing.createdAt)}</span>
								</div>

								{listing.body && (
									<p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-white/40">
										{listing.body}
									</p>
								)}

								{me?.handle === listing.handle && (
									<button
										onClick={() => removeListing(listing.id)}
										className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-rose-400"
									>
										<HugeiconsIcon icon={Delete02Icon} size={12} strokeWidth={2} /> Remove
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
