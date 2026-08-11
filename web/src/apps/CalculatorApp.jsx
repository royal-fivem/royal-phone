import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Delete02Icon,
	Cancel01Icon,
	Clock01Icon,
	PercentIcon,
	DivideSignIcon,
	MultiplicationSignIcon,
	MinusSignIcon,
	PlusSignIcon,
	EqualSignIcon,
} from '@hugeicons/core-free-icons';

/**
 * Calculator.
 *
 * No store and no Lua — the tape lives for as long as the screen is mounted,
 * which is the whole app. Arithmetic runs on an explicit accumulator rather
 * than by parsing a string, so there is no eval anywhere near player input.
 */

//#region maths

const OPERATORS = {
	'+': (a, b) => a + b,
	'-': (a, b) => a - b,
	'*': (a, b) => a * b,
	'/': (a, b) => (b === 0 ? NaN : a / b),
};

/** Trim float noise (0.1 + 0.2) without turning integers into 3.00. */
const clean = (value) => {
	if (!Number.isFinite(value)) return 'Error';

	const rounded = Number(value.toPrecision(12));
	if (Math.abs(rounded) >= 1e12) return rounded.toExponential(6);

	return String(rounded);
};

/** Group the integer part so long results stay readable. */
const group = (text) => {
	if (text === 'Error' || text.includes('e')) return text;

	const negative = text.startsWith('-');
	const [whole, fraction] = (negative ? text.slice(1) : text).split('.');
	const spaced = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

	return `${negative ? '-' : ''}${spaced}${fraction !== undefined ? `.${fraction}` : ''}`;
};

/** Shrink the display as the number outgrows the phone's width. */
const displaySize = (text) => {
	if (text.length <= 8) return 46;
	if (text.length <= 11) return 38;
	if (text.length <= 14) return 31;
	return 25;
};

//#endregion

//#region keys

const KEYS = [
	{ id: 'clear', label: 'AC', tone: 'accent' },
	{ id: 'sign', label: '+/−', tone: 'accent' },
	{ id: 'percent', icon: PercentIcon, tone: 'accent' },
	{ id: '/', icon: DivideSignIcon, tone: 'operator' },

	{ id: '7', label: '7' },
	{ id: '8', label: '8' },
	{ id: '9', label: '9' },
	{ id: '*', icon: MultiplicationSignIcon, tone: 'operator' },

	{ id: '4', label: '4' },
	{ id: '5', label: '5' },
	{ id: '6', label: '6' },
	{ id: '-', icon: MinusSignIcon, tone: 'operator' },

	{ id: '1', label: '1' },
	{ id: '2', label: '2' },
	{ id: '3', label: '3' },
	{ id: '+', icon: PlusSignIcon, tone: 'operator' },

	{ id: '0', label: '0', wide: true },
	{ id: '.', label: '.' },
	{ id: 'equals', icon: EqualSignIcon, tone: 'equals' },
];

const TONES = {
	digit: 'bg-white/[0.07] text-white hover:bg-white/[0.11]',
	accent: 'bg-white/[0.12] text-white/70 hover:bg-white/[0.16]',
	operator: 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25',
	equals: 'bg-sky-500 text-white hover:bg-sky-400',
};

/** Keyboard equivalents, so the phone's own keypad is not the only way in. */
const FROM_KEY = {
	Enter: 'equals',
	'=': 'equals',
	Escape: 'clear',
	Backspace: 'backspace',
	'%': 'percent',
	x: '*',
	X: '*',
	',': '.',
};

//#endregion

export default function CalculatorApp() {
	/** What the display shows right now, always a string. */
	const [entry, setEntry] = useState('0');
	/** Left-hand side of a pending operation, and the operator waiting on it. */
	const [accumulator, setAccumulator] = useState(null);
	const [operator, setOperator] = useState(null);
	/** True while the next digit should start a fresh number. */
	const [fresh, setFresh] = useState(true);

	const [tape, setTape] = useState([]);
	const [showTape, setShowTape] = useState(false);

	/** Briefly lit key, for keyboard input — the taps light themselves. */
	const [flash, setFlash] = useState(null);
	const flashTimer = useRef(null);

	useEffect(() => () => clearTimeout(flashTimer.current), []);

	const digit = (value) => {
		if (value === '.' ) {
			if (fresh) {
				setEntry('0.');
				setFresh(false);
				return;
			}
			if (entry.includes('.')) return;
			return setEntry(entry + '.');
		}

		if (fresh || entry === '0' || entry === 'Error') {
			setEntry(value);
			setFresh(false);
			return;
		}

		// The display is the only limit worth having.
		if (entry.replace('-', '').replace('.', '').length >= 12) return;
		setEntry(entry + value);
	};

	/** Fold the pending operation, if there is one, and return the result. */
	const resolve = () => {
		const right = Number(entry);
		if (accumulator === null || operator === null) return right;

		const result = OPERATORS[operator](accumulator, right);

		setTape((list) =>
			[{ id: Date.now(), expression: `${clean(accumulator)} ${operator} ${clean(right)}`, result: clean(result) }, ...list].slice(0, 30)
		);

		return result;
	};

	const apply = (next) => {
		// Chaining without pressing equals: 2 + 3 + folds the first pair.
		const value = fresh && operator !== null ? accumulator : resolve();

		setEntry(clean(value));
		setAccumulator(Number.isFinite(value) ? value : null);
		setOperator(next);
		setFresh(true);
	};

	const press = (id) => {
		if (/^[0-9.]$/.test(id)) return digit(id);
		if (id in OPERATORS) return apply(id);

		switch (id) {
			case 'clear':
				setEntry('0');
				setAccumulator(null);
				setOperator(null);
				setFresh(true);
				return;

			case 'backspace':
				if (fresh || entry === 'Error') return;
				setEntry(entry.length <= 1 || (entry.length === 2 && entry.startsWith('-')) ? '0' : entry.slice(0, -1));
				return;

			case 'sign':
				if (entry === '0' || entry === 'Error') return;
				setEntry(entry.startsWith('-') ? entry.slice(1) : `-${entry}`);
				return;

			case 'percent': {
				const value = Number(entry);
				// A percentage of the pending left-hand side, the way a desk
				// calculator does it — 200 + 10% is 220, not 200.1.
				const base = accumulator !== null && (operator === '+' || operator === '-') ? accumulator : 1;

				setEntry(clean((value / 100) * base));
				setFresh(false);
				return;
			}

			case 'equals': {
				const value = resolve();

				setEntry(clean(value));
				setAccumulator(null);
				setOperator(null);
				setFresh(true);
				return;
			}

			default:
		}
	};

	// Keyboard input. The phone has NUI focus while open, so these never leak
	// into the game.
	useEffect(() => {
		const onKey = (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;

			const id = FROM_KEY[event.key] ?? event.key;
			const known = /^[0-9.]$/.test(id) || id in OPERATORS || ['clear', 'backspace', 'sign', 'percent', 'equals'].includes(id);
			if (!known) return;

			// Escape closes the phone; the calculator only takes it as AC while
			// there is something to clear.
			if (id === 'clear' && entry === '0' && accumulator === null) return;

			event.preventDefault();
			event.stopPropagation();
			press(id);

			setFlash(id);
			clearTimeout(flashTimer.current);
			flashTimer.current = setTimeout(() => setFlash(null), 110);
		};

		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});

	const shown = group(entry);
	const pending = operator && accumulator !== null ? `${group(clean(accumulator))} ${operator}` : '';

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-1 px-5 pb-1 pt-1">
				<h1 className="flex-1 truncate text-[26px] font-bold leading-tight tracking-tight text-white">
					Calculator
				</h1>

				<button
					onClick={() => setShowTape((v) => !v)}
					className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 hover:text-white ${
						showTape ? 'bg-white/10 text-white' : 'text-white/70'
					}`}
				>
					<HugeiconsIcon icon={showTape ? Cancel01Icon : Clock01Icon} size={18} strokeWidth={1.9} />
				</button>
			</header>

			{/* Tape. Slides over the display rather than pushing the keypad down,
			    so the keys never move under the player's thumb. */}
			<div className="relative min-h-0 flex-1">
				<div className="flex h-full flex-col justify-end px-5 pb-3">
					<div className="h-[18px] truncate text-right text-[13px] tabular-nums text-white/35">{pending}</div>

					<motion.div
						key={shown.length}
						initial={{ opacity: 0.6 }}
						animate={{ opacity: 1 }}
						className="truncate text-right font-bold tabular-nums leading-none text-white"
						style={{ fontSize: displaySize(shown) }}
					>
						{shown}
					</motion.div>
				</div>

				<AnimatePresence>
					{showTape && (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							className="absolute inset-0 flex flex-col bg-black/70 backdrop-blur-xl"
						>
							<div className="flex items-center justify-between px-5 pb-2 pt-3">
								<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">History</h2>

								{tape.length > 0 && (
									<button
										onClick={() => setTape([])}
										className="flex items-center gap-1.5 text-[12px] font-medium text-white/45 transition hover:text-white"
									>
										<HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={2} /> Clear
									</button>
								)}
							</div>

							<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-3">
								{tape.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
										<HugeiconsIcon icon={Clock01Icon} size={30} strokeWidth={1.4} className="text-white/25" />
										<span className="text-[13px] font-medium text-white/40">Nothing worked out yet</span>
									</div>
								) : (
									tape.map((row) => (
										<button
											key={row.id}
											onClick={() => {
												setEntry(row.result);
												setAccumulator(null);
												setOperator(null);
												setFresh(true);
												setShowTape(false);
											}}
											className="w-full rounded-xl px-1 py-2 text-right transition hover:bg-white/[0.05]"
										>
											<div className="truncate text-[12px] tabular-nums text-white/35">{row.expression}</div>
											<div className="truncate text-[17px] font-bold tabular-nums text-white">{row.result}</div>
										</button>
									))
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className="grid shrink-0 grid-cols-4 gap-2 px-4 pb-1">
				{KEYS.map((key) => {
					// AC turns into a backspace once there is a number to trim.
					const backspace = key.id === 'clear' && !fresh && entry !== '0';
					const id = backspace ? 'backspace' : key.id;

					return (
						<button
							key={key.id}
							onClick={() => press(id)}
							className={`flex h-[46px] items-center justify-center rounded-2xl text-[20px] font-semibold transition active:scale-[0.96] ${
								TONES[key.tone ?? 'digit']
							} ${key.wide ? 'col-span-2' : ''} ${flash === id ? 'brightness-150' : ''}`}
						>
							{backspace ? (
								<HugeiconsIcon icon={Delete02Icon} size={20} strokeWidth={1.9} />
							) : key.icon ? (
								<HugeiconsIcon icon={key.icon} size={20} strokeWidth={2.2} />
							) : (
								key.label
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
