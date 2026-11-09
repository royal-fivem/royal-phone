// Example app. Everything phone-related goes through window.RoyalPhone
// (royal-phone.js); everything game-related goes through RoyalPhone.fetch to
// the RegisterNUICallback handlers in ../client.lua.

const $ = (id) => document.getElementById(id);

// Placeholder data used when the page is opened in a plain browser.
const MOCK_CONTACTS = [
	{ id: 1, name: 'Mikkel', number: '555-0101' },
	{ id: 2, name: 'Sara Vance', number: '555-0199' },
	{ id: 3, name: 'Chop Shop', number: '555-0420' },
];

let contacts = [];

// ── Tabs ──────────────────────────────────────────────────────────────────

function showTab(name) {
	for (const tab of document.querySelectorAll('.rp-tab')) {
		tab.classList.toggle('rp-active', tab.dataset.tab === name);
	}

	$('tab-home').classList.toggle('rp-hidden', name !== 'home');
	$('tab-contacts').classList.toggle('rp-hidden', name !== 'contacts');
	$('title').textContent = name === 'home' ? 'Example' : 'Contacts';

	if (name === 'contacts') loadContacts();
}

for (const tab of document.querySelectorAll('.rp-tab')) {
	tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

// Escape / back gesture: leave the contacts tab first, then the app.
RoyalPhone.on('back', () => {
	if (!$('tab-contacts').classList.contains('rp-hidden')) showTab('home');
	else RoyalPhone.back();
});

$('close').addEventListener('click', () => RoyalPhone.close());

// ── Contacts ──────────────────────────────────────────────────────────────

function renderContacts() {
	const query = $('search').value.trim().toLowerCase();
	const shown = contacts.filter(
		(c) => !query || c.name.toLowerCase().includes(query) || c.number.includes(query)
	);

	const list = $('contacts');
	list.replaceChildren();

	for (const contact of shown) {
		const row = document.createElement('button');
		row.className = 'rp-item';

		const avatar = document.createElement('div');
		avatar.className = 'rp-avatar';
		avatar.textContent = contact.name.charAt(0).toUpperCase();

		const text = document.createElement('div');
		text.className = 'rp-item-text';

		const title = document.createElement('div');
		title.className = 'rp-item-title';
		title.textContent = contact.name;

		const sub = document.createElement('div');
		sub.className = 'rp-item-sub';
		sub.textContent = contact.number;

		text.append(title, sub);
		row.append(avatar, text);

		// Hand off to the built-in Messages app, straight into the thread.
		row.addEventListener('click', () => RoyalPhone.openApp('messages', { number: contact.number }));

		list.append(row);
	}

	$('empty').classList.toggle('rp-hidden', shown.length > 0);
}

async function loadContacts() {
	contacts = (await RoyalPhone.fetch('getContacts', {}, MOCK_CONTACTS)) || [];
	renderContacts();
}

$('search').addEventListener('input', renderContacts);

// ── Home ──────────────────────────────────────────────────────────────────

$('notify').addEventListener('click', () => {
	RoyalPhone.notify({ title: 'Example', content: 'Hello from your own app.', sound: true });
});

$('text').addEventListener('click', async () => {
	await RoyalPhone.fetch('textMe');
});

$('ping').addEventListener('click', async () => {
	$('pong').textContent = 'Waiting for the server…';
	await RoyalPhone.fetch('ping', {}, true);

	// In a browser there is no server to answer, so fake its reply.
	if (!RoyalPhone.inGame) setTimeout(() => $('pong').textContent = 'pong (browser mock)', 500);
});

// The server answers with exports['royal-phone']:SendAppMessage(src, 'example', 'pong', {...}).
RoyalPhone.on('pong', (data) => {
	$('pong').textContent = `pong · server time ${data.time}`;
});

$('save').addEventListener('click', async () => {
	const ok = await RoyalPhone.fetch('saveNote', { note: $('note').value }, true);
	RoyalPhone.notify({ title: 'Example', content: ok ? 'Note saved.' : 'Could not save the note.' });
});

// Opened from one of this app's notifications.
RoyalPhone.on('route', (route) => {
	if (route && route.tab) showTab(route.tab);
});

// ── Start ─────────────────────────────────────────────────────────────────

RoyalPhone.ready().then(async (phone) => {
	$('name').textContent = phone.name || 'Unknown';
	$('number').textContent = phone.number || 'No number';
	$('initial').textContent = (phone.name || '?').charAt(0).toUpperCase();
	$('subtitle').textContent = phone.job ? `Signed in as ${phone.job}` : 'Built with the Royal Phone kit';

	$('note').value = (await RoyalPhone.fetch('loadNote', {}, '')) || '';

	if (phone.route && phone.route.tab) showTab(phone.route.tab);
});
