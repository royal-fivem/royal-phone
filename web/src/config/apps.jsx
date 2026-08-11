import {
	Calculator01Icon,
	Folder01Icon,
	CourtLawIcon,
	FishFoodIcon,
	BankIcon,
	Album02Icon,
	Car03Icon,
	UserGroupIcon,
	MusicNote01Icon,
	News01Icon,
	RealEstate01Icon,
	Settings01Icon,
	ChartLineData01Icon,
	MaskIcon,
	Briefcase01Icon,
	Chatting01Icon,
	CloudIcon,
	Call02Icon,
	Message01Icon,
	Contact01Icon,
	InternetIcon,
	Camera01Icon,
} from '@hugeicons/core-free-icons';

import { lazy } from 'react';

// App screens are code-split: the shell boots with only the home screen in the
// bundle, and a screen's chunk is fetched the first time it is opened. AppHost
// wraps them in Suspense.
const MessagesApp = lazy(() => import('../apps/MessagesApp'));
const SettingsApp = lazy(() => import('../apps/SettingsApp'));
const DialerApp = lazy(() => import('../apps/DialerApp'));
const BankApp = lazy(() => import('../apps/BankApp'));
const GalleryApp = lazy(() => import('../apps/GalleryApp'));
const LifeinvaderApp = lazy(() => import('../apps/LifeinvaderApp'));
const FishingApp = lazy(() => import('../apps/FishingApp'));
const CalculatorApp = lazy(() => import('../apps/CalculatorApp'));
const DocumentsApp = lazy(() => import('../apps/DocumentsApp'));
const ContactsApp = lazy(() => import('../apps/ContactsApp'));
const CameraApp = lazy(() => import('../apps/CameraApp'));

/**
 * Single source of truth for the home screen. `id` is what the layout store
 * persists, so renaming one breaks saved layouts.
 *
 * Only Messages has a `component` for now — everything else renders StubApp,
 * which is the hook for building the rest out one at a time.
 */
export const APPS = [
	{
		id: 'calculator',
		label: 'Calculator',
		icon: Calculator01Icon,
		gradient: 'bg-gradient-to-br from-zinc-600 to-zinc-800',
		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#161a22_0%,#0a0c11_55%,#040507_100%)]',
		component: CalculatorApp,
	},
	{
		id: 'documents',
		label: 'Documents',
		icon: Folder01Icon,
		gradient: 'bg-gradient-to-br from-sky-300 to-sky-500',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#111c2b_0%,#080c13_55%,#040609_100%)]',
		component: DocumentsApp,
	},
	// { id: 'doj', label: 'DOJ', icon: CourtLawIcon, gradient: 'bg-gradient-to-br from-neutral-700 to-black' },
	{
		id: 'fishing',
		label: 'Fishing',
		icon: FishFoodIcon,
		gradient: 'bg-gradient-to-br from-sky-500 to-blue-700',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#0b2233_0%,#060d16_55%,#03060a_100%)]',
		component: FishingApp,
	},

	{
		id: 'bank',
		label: 'Bank',
		icon: BankIcon,
		gradient: 'bg-gradient-to-br from-emerald-600 to-green-900',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#0e1a14_0%,#070b09_55%,#040605_100%)]',
		component: BankApp,
	},
	{ id: 'garage', label: 'Garage', icon: Car03Icon, gradient: 'bg-gradient-to-br from-neutral-300 to-neutral-600' },
	{
		id: 'lifeinvader',
		label: 'Lifeinvader',
		icon: UserGroupIcon,
		gradient: 'bg-gradient-to-br from-red-500 to-rose-700',
		background: 'bg-[#07080c]',
		component: LifeinvaderApp,
	},

	// { id: 'music', label: 'Music', icon: MusicNote01Icon, gradient: 'bg-gradient-to-br from-slate-700 to-slate-900' },
	// { id: 'news', label: 'News', icon: News01Icon, gradient: 'bg-gradient-to-br from-rose-400 to-red-700' },
	// { id: 'estate', label: 'Estate', icon: RealEstate01Icon, gradient: 'bg-gradient-to-br from-rose-200 to-rose-400' },

	// { id: 'ventures', label: 'Ventures', icon: ChartLineData01Icon, gradient: 'bg-gradient-to-br from-amber-500 to-yellow-800' },
	// { id: 'underground', label: 'Underground', icon: MaskIcon, gradient: 'bg-gradient-to-br from-zinc-700 to-black' },
	// { id: 'hustlr', label: 'Hustlr', icon: Briefcase01Icon, gradient: 'bg-gradient-to-br from-emerald-400 to-teal-800' },
	// { id: 'cliq', label: 'Cliq', icon: Chatting01Icon, gradient: 'bg-gradient-to-br from-yellow-400 to-amber-700' },

	// { id: 'weather', label: 'Weather', icon: CloudIcon, gradient: 'bg-gradient-to-br from-sky-300 to-blue-600' },

	// { id: 'browser', label: 'Browser', icon: InternetIcon, gradient: 'bg-gradient-to-br from-emerald-400 to-green-600' },

	// dock
	{
		id: 'dialer',
		label: 'Phone',
		icon: Call02Icon,
		// Artwork filename differs from the id here.
		image: 'Phonecall',
		gradient: 'bg-gradient-to-br from-green-400 to-green-600',
		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#101c33_0%,#070b14_55%,#03050a_100%)]',
		component: DialerApp,
	},
	{
		id: 'messages',
		label: 'Messages',
		icon: Message01Icon,
		gradient: 'bg-gradient-to-br from-sky-400 to-blue-600',
		// Same backdrop as the Phone app — the two are meant to read as one pair.
		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#101c33_0%,#070b14_55%,#03050a_100%)]',
		component: MessagesApp,
	},
	{
		id: 'contacts',
		label: 'Contacts',
		icon: Contact01Icon,
		gradient: 'bg-gradient-to-br from-orange-400 to-amber-600',
		// The Phone app's backdrop: it is literally the same screen on its own icon.
		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#101c33_0%,#070b14_55%,#03050a_100%)]',
		component: ContactsApp,
	},
	{
		id: 'camera',
		label: 'Camera',
		icon: Camera01Icon,
		gradient: 'bg-gradient-to-br from-zinc-700 to-black',
		// Nothing is drawn inside the phone — the viewfinder takes the screen.
		background: 'bg-transparent',
		component: CameraApp,
	},
	{
		id: 'settings',
		label: 'Settings',
		icon: Settings01Icon,
		gradient: 'bg-gradient-to-br from-zinc-500 to-zinc-800',
		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#12203d_0%,#070c18_55%,#03050b_100%)]',
		component: SettingsApp,
	},
	{
		id: 'gallery',
		label: 'Gallery',
		icon: Album02Icon,
		gradient: 'bg-gradient-to-br from-amber-100 to-amber-300',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#241a2e_0%,#0d0a12_55%,#050409_100%)]',
		component: GalleryApp,
	},
];

const BY_ID = Object.fromEntries(APPS.map((app) => [app.id, app]));

export const getApp = (id) => BY_ID[id];
export const APP_IDS = APPS.map((app) => app.id);
