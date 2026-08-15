import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Exchange01Icon, Clock01Icon, Invoice01Icon, BankIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

import useDataStore from '../state/dataStore';
import { formatMoney, formatRelative } from '../utils/format';
import fetchNui from '../utils/fetchNui';

const TABS = ['Finance', 'Bills', 'Loans'];

const initials = (label = '') =>
	label
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0])
		.join('')
		.toUpperCase() || '··';

function SectionHead({ title, action = 'VIEW ALL', onAction }) {
	return (
		<div className="mb-2 flex items-baseline justify-between px-1">
			<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{title}</h2>
			{action && (
				<button
					onClick={onAction}
					className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
				>
					{action}
				</button>
			)}
		</div>
	);
}

function Row({ badge, badgeClass = 'bg-white/[0.07] text-white/70', title, subtitle, amount }) {
	const negative = amount < 0;

	return (
		<div className="flex items-center gap-3 border-b border-white/[0.05] px-1 py-3 last:border-0">
			<span
				className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[12px] font-bold ${badgeClass}`}
			>
				{badge}
			</span>

			<div className="min-w-0 flex-1">
				<div className="truncate text-[14px] font-semibold text-white">{title}</div>
				{subtitle && <div className="truncate text-[12px] text-white/35">{subtitle}</div>}
			</div>

			{typeof amount === 'number' && (
				<span
					className={`shrink-0 text-[14px] font-bold tabular-nums ${
						negative ? 'text-rose-500' : 'text-emerald-400'
					}`}
				>
					{negative ? '-' : '+'}
					{formatMoney(Math.abs(amount))}
				</span>
			)}
		</div>
	);
}

function TransferSheet({ onClose }) {
	const contacts = useDataStore((s) => s.contacts);
	const setData = useDataStore((s) => s.setData);

	const [number, setNumber] = useState('');
	const [amount, setAmount] = useState('');
	const [status, setStatus] = useState(null);

	const submit = async (event) => {
		event?.preventDefault();

		const value = Number(amount);
		if (!number.trim() || !Number.isFinite(value) || value <= 0) {
			return setStatus({ error: 'Pick a number and an amount.' });
		}

		setStatus({ sending: true });

		const result = await fetchNui(
			'bank:transfer',
			{ number: number.trim(), amount: Math.floor(value) },
			{ ok: true }
		);

		if (!result || result.error) {
			return setStatus({ error: result?.error ?? 'Transfer failed.' });
		}

		setData({ bank: (useDataStore.getState().bank ?? 0) - Math.floor(value) });

		setStatus({ done: true });
		setAmount('');
	};

	return (
		<motion.form
			onSubmit={submit}
			initial={{ opacity: 0, height: 0 }}
			animate={{ opacity: 1, height: 'auto' }}
			className="mb-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4"
		>
			<div className="mb-2 flex items-center justify-between">
				<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Transfer</span>
				<button type="button" onClick={onClose} className="text-white/35 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
				</button>
			</div>

			<input
				value={number}
				onChange={(e) => setNumber(e.target.value)}
				placeholder="To number"
				className="mb-2 w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
			/>

			<input
				value={amount}
				onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
				onKeyDown={(e) => e.key === 'Enter' && submit(e)}
				inputMode="numeric"
				placeholder="Amount"
				className="mb-2 w-full rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[14px] tabular-nums text-white outline-none placeholder:text-white/30"
			/>

			{contacts.length > 0 && (
				<div className="royal-scroll-x mb-2 flex gap-2 overflow-x-auto pb-1">
					{contacts.map((contact) => (
						<button
							key={contact.id}
							type="button"
							onClick={() => setNumber(contact.number)}
							className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
						>
							{contact.name}
						</button>
					))}
				</div>
			)}

			{status?.error && <p className="mb-2 text-[12px] text-rose-400">{status.error}</p>}
			{status?.done && <p className="mb-2 text-[12px] text-emerald-400">Sent.</p>}

			<button
				type="submit"
				disabled={status?.sending}
				className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
			>
				{status?.sending ? 'Sending…' : 'Send'}
			</button>
		</motion.form>
	);
}

function Finance() {
	const { bank, cash, name, number, transactions } = useDataStore();

	const [transferring, setTransferring] = useState(false);
	const [showAll, setShowAll] = useState(false);

	const rows = transactions ?? [];

	const weekDelta = useMemo(() => {
		const cutoff = Date.now() - 7 * 86_400_000;
		return rows
			.filter((entry) => (entry.createdAt ?? 0) >= cutoff)
			.reduce((total, entry) => total + (entry.amount ?? 0), 0);
	}, [rows]);

	return (
		<>
			<div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
				<div className="flex items-start justify-between">
					<span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
						Total balance
					</span>
					<span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
						Last 7 days
					</span>
				</div>

				<div className="mt-1.5 flex items-end justify-between">
					<span className="text-[30px] font-bold leading-none tracking-tight text-white">
						{formatMoney(bank)}
					</span>
					<span
						className={`text-[15px] font-bold tabular-nums ${
							weekDelta < 0 ? 'text-rose-500' : 'text-emerald-400'
						}`}
					>
						{weekDelta < 0 ? '-' : '+'}
						{formatMoney(Math.abs(weekDelta))}
					</span>
				</div>
			</div>

			<div className="mb-4 flex gap-3">
				<motion.button
					whileTap={{ scale: 0.97 }}
					onClick={() => setTransferring((v) => !v)}
					className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 py-2.5 text-[14px] font-semibold text-white"
				>
					<HugeiconsIcon icon={Exchange01Icon} size={16} strokeWidth={2} /> Transfer
				</motion.button>

				<motion.button
					whileTap={{ scale: 0.97 }}
					onClick={() => setShowAll((v) => !v)}
					className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[14px] font-semibold text-white ${
						showAll ? 'border-white/25 bg-white/[0.09]' : 'border-white/15 bg-white/[0.03]'
					}`}
				>
					<HugeiconsIcon icon={Clock01Icon} size={16} strokeWidth={2} /> History
				</motion.button>
			</div>

			<AnimatePresence>
				{transferring && <TransferSheet onClose={() => setTransferring(false)} />}
			</AnimatePresence>

			<SectionHead title="Bank accounts" />
			<div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5">
				<div className="flex items-center gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-[14px] font-bold text-white">
						{(name || '?').charAt(0).toUpperCase()}
					</span>

					<div className="min-w-0 flex-1">
						<div className="truncate text-[14.5px] font-semibold text-white">{name || 'Unknown'}</div>
						<div className="truncate text-[12px] text-white/35">
							{(number || '').replace(/\D/g, '').slice(-6) || '——'} · Personal
						</div>
					</div>

					<span className="shrink-0 text-[15px] font-bold tabular-nums text-white">{formatMoney(bank)}</span>
				</div>
			</div>

			<SectionHead
				title="Recent activity"
				action={rows.length > 6 ? (showAll ? 'SHOW LESS' : 'VIEW ALL') : null}
				onAction={() => setShowAll((v) => !v)}
			/>
			{rows.length === 0 ? (
				<div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center">
					<HugeiconsIcon icon={BankIcon} size={26} strokeWidth={1.4} className="mx-auto text-white/20" />
					<p className="mt-2 text-[13px] text-white/35">No transactions yet</p>
					<p className="mt-1 text-[11.5px] leading-snug text-white/25">
						Phone transfers show up here. Other resources add lines with the{' '}
						<code className="text-white/40">AddTransaction</code> export.
					</p>
				</div>
			) : (
				<div className="pb-2">
					{(showAll ? rows : rows.slice(0, 6)).map((entry) => (
						<Row
							key={entry.id}
							badge={initials(entry.label)}
							title={entry.label}
							subtitle={formatRelative(entry.createdAt)}
							amount={entry.amount}
						/>
					))}
				</div>
			)}

			<div className="mt-1 flex items-center justify-between px-1 pb-2 text-[12px] text-white/30">
				<span>Cash on hand</span>
				<span className="tabular-nums">{formatMoney(cash)}</span>
			</div>
		</>
	);
}

function Placeholder({ label }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
			<HugeiconsIcon icon={Invoice01Icon} size={30} strokeWidth={1.4} className="text-white/20" />
			<span className="text-[14px] font-medium text-white/40">No {label.toLowerCase()}</span>
		</div>
	);
}

export default function BankApp() {
	const [tab, setTab] = useState('Finance');

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<nav className="flex shrink-0 items-center px-5 pt-1">
				{TABS.map((item) => {
					const active = tab === item;

					return (
						<button
							key={item}
							onClick={() => setTab(item)}
							className={`relative flex-1 pb-2.5 text-[15px] font-semibold transition ${
								active ? 'text-white' : 'text-white/35 hover:text-white/60'
							}`}
						>
							{item}

							{active && (
								<span className="absolute inset-x-3 -bottom-px h-[2.5px] rounded-full bg-emerald-500" />
							)}
						</button>
					);
				})}
			</nav>

			<div className="mb-3 h-px shrink-0 bg-white/[0.07]" />

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5">
				{tab === 'Finance' && <Finance />}
				{tab === 'Bills' && <Placeholder label="Bills" />}
				{tab === 'Loans' && <Placeholder label="Loans" />}
			</div>
		</div>
	);
}
