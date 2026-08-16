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

import MessagesApp from '../apps/MessagesApp';
import SettingsApp from '../apps/SettingsApp';
import DialerApp from '../apps/DialerApp';
import BankApp from '../apps/BankApp';
import GalleryApp from '../apps/GalleryApp';
import LifeinvaderApp from '../apps/LifeinvaderApp';
import FishingApp from '../apps/FishingApp';
import CalculatorApp from '../apps/CalculatorApp';
import DocumentsApp from '../apps/DocumentsApp';
import ContactsApp from '../apps/ContactsApp';
import CameraApp from '../apps/CameraApp';
import GarageApp from '../apps/GarageApp';
import useCustomStore from '../state/customStore';

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

	{
		id: 'bank',
		label: 'Bank',
		icon: BankIcon,
		gradient: 'bg-gradient-to-br from-emerald-600 to-green-900',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#0e1a14_0%,#070b09_55%,#040605_100%)]',
		component: BankApp,
	},

	{
		id: 'garage',
		label: 'Garage',
		icon: Car03Icon,
		gradient: 'bg-gradient-to-br from-neutral-300 to-neutral-600',
		background: 'bg-[radial-gradient(120%_80%_at_50%_-10%,#1a1c20_0%,#0b0c0e_55%,#050607_100%)]',
		component: GarageApp,
	},

	{
		id: 'lifeinvader',
		label: 'Lifeinvader',
		icon: UserGroupIcon,
		gradient: 'bg-gradient-to-br from-red-500 to-rose-700',
		background: 'bg-[#07080c]',
		component: LifeinvaderApp,
	},

	{
		id: 'dialer',
		label: 'Phone',
		icon: Call02Icon,

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

		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#101c33_0%,#070b14_55%,#03050a_100%)]',
		component: MessagesApp,
	},
	{
		id: 'contacts',
		label: 'Contacts',
		icon: Contact01Icon,
		gradient: 'bg-gradient-to-br from-orange-400 to-amber-600',

		background: 'bg-[radial-gradient(120%_80%_at_50%_115%,#101c33_0%,#070b14_55%,#03050a_100%)]',
		component: ContactsApp,
	},
	{
		id: 'camera',
		label: 'Camera',
		icon: Camera01Icon,
		gradient: 'bg-gradient-to-br from-zinc-700 to-black',

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

export const APP_IDS = APPS.map((app) => app.id);

export const getApp = (id) => BY_ID[id] ?? useCustomStore.getState().byId[id];

export const allAppIds = () => [...APP_IDS, ...useCustomStore.getState().apps.map((app) => app.id)];
