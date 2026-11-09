/*
 * Royal Phone docs — builds the shared chrome around each page.
 *
 * A page is just <main><article class="content">…</article></main>. This file
 * adds the top bar, the sidebar (from NAV below), the "On this page" list,
 * heading anchors, copy buttons, syntax highlighting, search, the theme toggle
 * and the previous / next links. To add a page: create the .html file and add
 * it to NAV.
 */
(function () {
	'use strict';

	const REPO = 'https://github.com/royal-fivem/royal-phone';

	const NAV = [
		{
			title: 'Getting started',
			pages: [
				{ file: 'index.html', title: 'Introduction' },
				{ file: 'installation.html', title: 'Installation' },
				{ file: 'configuration.html', title: 'Configuration' },
			],
		},
		{
			title: 'Using the phone',
			pages: [
				{ file: 'using-the-phone.html', title: 'Controls & basics' },
				{ file: 'notifications-and-calls.html', title: 'Notifications & calls' },
				{ file: 'sim-cards.html', title: 'SIM cards' },
				{ file: 'apps.html', title: 'Built-in apps' },
			],
		},
		{
			title: 'For developers',
			pages: [
				{ file: 'custom-apps.html', title: 'Make your own app' },
				{ file: 'api.html', title: 'Exports & events' },
				{ file: 'frameworks.html', title: 'Frameworks & bridge' },
				{ file: 'development.html', title: 'Working on the UI' },
			],
		},
		{
			title: 'Reference',
			pages: [
				{ file: 'database.html', title: 'Database' },
				{ file: 'troubleshooting.html', title: 'Troubleshooting & FAQ' },
			],
		},
	];

	const escapeHtml = (text) =>
		text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	const PAGES = NAV.flatMap((group) => group.pages);
	const here = (location.pathname.split('/').pop() || 'index.html').replace(/[?#].*$/, '') || 'index.html';
	const currentIndex = PAGES.findIndex((p) => p.file === here);

	const icon = {
		logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
		search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
		menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
		github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 015.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0012 .5z"/></svg>',
		sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
		moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
	};

	// ── Theme ────────────────────────────────────────────────────────────

	const store = {
		get(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* private mode: the toggle still works for this page view */
			}
		},
	};

	const savedTheme = store.get('rp-docs-theme');
	if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;

	const effectiveTheme = () =>
		document.documentElement.dataset.theme ||
		(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

	// ── Chrome ───────────────────────────────────────────────────────────

	const main = document.querySelector('main');
	const content = document.querySelector('.content');
	if (!main || !content) return;

	const topbar = document.createElement('header');
	topbar.className = 'topbar';
	topbar.innerHTML = `
		<button class="icon-btn menu-btn" aria-label="Menu">${icon.menu}</button>
		<a class="brand" href="index.html"><span class="brand-mark">${icon.logo}</span><span class="name">Royal Phone</span><small>Docs</small></a>
		<div class="topbar-spacer"></div>
		<div class="search">
			${icon.search}
			<input type="search" placeholder="Search the docs" aria-label="Search the docs" autocomplete="off" />
			<div class="search-results" role="listbox"></div>
		</div>
		<button class="icon-btn theme-btn" aria-label="Toggle dark mode"></button>
		<a class="icon-btn" href="${REPO}" aria-label="GitHub repository">${icon.github}</a>
	`;

	const sidebar = document.createElement('nav');
	sidebar.className = 'sidebar';
	sidebar.setAttribute('aria-label', 'Documentation');
	sidebar.innerHTML = NAV.map(
		(group) =>
			`<h4>${group.title}</h4>` +
			group.pages
				.map((p) => `<a href="${p.file}"${p.file === here ? ' class="active" aria-current="page"' : ''}>${p.title}</a>`)
				.join('')
	).join('');

	const toc = document.createElement('aside');
	toc.className = 'toc';

	const layout = document.createElement('div');
	layout.className = 'layout';

	const scrim = document.createElement('div');
	scrim.className = 'scrim';

	main.parentNode.insertBefore(topbar, main);
	main.parentNode.insertBefore(layout, main);
	layout.append(sidebar, main, toc);
	document.body.append(scrim);

	const menuBtn = topbar.querySelector('.menu-btn');
	menuBtn.addEventListener('click', () => document.body.classList.toggle('nav-open'));
	scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));

	const themeBtn = topbar.querySelector('.theme-btn');
	const paintThemeBtn = () => (themeBtn.innerHTML = effectiveTheme() === 'dark' ? icon.sun : icon.moon);
	paintThemeBtn();
	themeBtn.addEventListener('click', () => {
		const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = next;
		store.set('rp-docs-theme', next);
		paintThemeBtn();
	});

	// ── Headings, anchors, table of contents ─────────────────────────────

	const slug = (text) =>
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

	// Only the page's own sections: not headings inside cards or callouts.
	const headings = [...content.querySelectorAll(':scope > h2, :scope > h3')];
	const used = new Set();

	for (const h of headings) {
		h.dataset.text = h.textContent.trim();

		if (!h.id) {
			let id = slug(h.textContent) || 'section';
			while (used.has(id)) id += '-';
			h.id = id;
		}
		used.add(h.id);

		const a = document.createElement('a');
		a.className = 'anchor';
		a.href = `#${h.id}`;
		a.textContent = '#';
		a.setAttribute('aria-label', 'Link to this section');
		h.append(a);
	}

	if (headings.length > 1) {
		toc.innerHTML =
			'<h5>On this page</h5>' +
			headings
				.map((h) => {
					const text = escapeHtml(h.dataset.text);
					return `<a href="#${h.id}" class="${h.tagName === 'H3' ? 'sub' : ''}">${text}</a>`;
				})
				.join('');

		const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
		let activeId = null;

		const spy = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
						for (const [id, link] of links) link.classList.toggle('active', id === activeId);
					}
				}
			},
			{ rootMargin: '-70px 0px -70% 0px' }
		);

		headings.forEach((h) => spy.observe(h));
	}

	// ── Tables scroll on small screens ───────────────────────────────────

	for (const table of content.querySelectorAll('table')) {
		if (table.parentElement.classList.contains('table-wrap')) continue;
		const wrap = document.createElement('div');
		wrap.className = 'table-wrap';
		table.parentNode.insertBefore(wrap, table);
		wrap.append(table);
	}

	// ── Code blocks: label + copy ────────────────────────────────────────

	for (const pre of content.querySelectorAll('pre')) {
		const wrap = document.createElement('div');
		wrap.className = 'code';
		pre.parentNode.insertBefore(wrap, pre);

		if (pre.dataset.label) {
			const label = document.createElement('div');
			label.className = 'label';
			label.textContent = pre.dataset.label;
			wrap.append(label);
		}

		wrap.append(pre);

		const btn = document.createElement('button');
		btn.className = 'copy-btn';
		btn.type = 'button';
		btn.textContent = 'Copy';
		btn.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ''));
				btn.textContent = 'Copied';
			} catch {
				btn.textContent = 'Press Ctrl+C';
			}
			setTimeout(() => (btn.textContent = 'Copy'), 1400);
		});
		wrap.append(btn);
	}

	// ── Previous / next + footer ─────────────────────────────────────────

	if (currentIndex >= 0) {
		const prev = PAGES[currentIndex - 1];
		const next = PAGES[currentIndex + 1];
		const pager = document.createElement('nav');
		pager.className = 'pager';
		pager.setAttribute('aria-label', 'Previous and next page');
		pager.innerHTML =
			(prev ? `<a class="prev" href="${prev.file}"><span>Previous</span>${prev.title}</a>` : '') +
			(next ? `<a class="next" href="${next.file}"><span>Next</span>${next.title}</a>` : '');
		content.append(pager);
	}

	const footer = document.createElement('footer');
	footer.className = 'site-footer';
	footer.innerHTML = `Royal Phone · GPL-3.0 · <a href="${REPO}/edit/main/docs/${here}">Edit this page on GitHub</a>`;
	content.append(footer);

	// ── Syntax highlighting (Prism from cdnjs) ───────────────────────────

	const PRISM = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/';
	const load = (src) =>
		new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = src;
			s.onload = resolve;
			s.onerror = reject;
			document.head.append(s);
		});

	if (content.querySelector('pre code')) {
		window.Prism = window.Prism || {};
		window.Prism.manual = true;

		load(PRISM + 'prism.min.js')
			.then(() =>
				Promise.all(
					['lua', 'bash', 'json', 'sql'].map((lang) => load(`${PRISM}components/prism-${lang}.min.js`))
				)
			)
			.then(() => window.Prism.highlightAllUnder(content))
			.catch(() => {
				/* offline: plain code blocks are fine */
			});
	}

	// ── Search ───────────────────────────────────────────────────────────
	//
	// The first time the box is used, every page is fetched and split into
	// sections (h2/h3 + the text under them). Fine for a dozen pages, and
	// needs no build step or index file to keep in sync.

	const input = topbar.querySelector('.search input');
	const results = topbar.querySelector('.search-results');
	let index = null;
	let selected = -1;

	async function buildIndex() {
		if (index) return index;

		const parser = new DOMParser();
		const pages = await Promise.all(
			PAGES.map(async (p) => {
				try {
					const html = p.file === here ? document.documentElement.outerHTML : await (await fetch(p.file)).text();
					return { page: p, doc: parser.parseFromString(html, 'text/html') };
				} catch {
					return null;
				}
			})
		);

		index = [];

		for (const entry of pages) {
			if (!entry) continue;

			const article = entry.doc.querySelector('.content');
			if (!article) continue;

			let section = { page: entry.page, title: entry.page.title, id: '', text: '' };
			index.push(section);

			for (const node of article.children) {
				if (/^H[23]$/.test(node.tagName)) {
					const title = node.textContent.replace(/#\s*$/, '').trim();
					section = { page: entry.page, title, id: node.id || slug(title), text: '' };
					index.push(section);
				} else if (!node.classList.contains('pager') && node.tagName !== 'FOOTER') {
					section.text += ' ' + node.textContent;
				}
			}
		}

		for (const s of index) s.haystack = (s.title + ' ' + s.text).toLowerCase();
		return index;
	}

	function render(list) {
		selected = -1;

		if (!list.length) {
			results.innerHTML = '<div class="empty">No results</div>';
		} else {
			results.innerHTML = list
				.map(
					(s) =>
						`<a href="${s.page.file}${s.id ? '#' + s.id : ''}">${escapeHtml(s.title)}<span>${escapeHtml(s.page.title)}</span></a>`
				)
				.join('');
		}

		results.classList.add('open');
	}

	input.addEventListener('focus', buildIndex);

	input.addEventListener('input', async () => {
		const query = input.value.trim().toLowerCase();
		if (!query) {
			results.classList.remove('open');
			return;
		}

		const words = query.split(/\s+/);
		const all = await buildIndex();

		const scored = all
			.map((s) => {
				if (!words.every((w) => s.haystack.includes(w))) return null;
				const inTitle = words.filter((w) => s.title.toLowerCase().includes(w)).length;
				return { s, score: inTitle * 10 + (s.id ? 1 : 0) };
			})
			.filter(Boolean)
			.sort((a, b) => b.score - a.score)
			.slice(0, 12)
			.map((x) => x.s);

		render(scored);
	});

	input.addEventListener('keydown', (event) => {
		const items = [...results.querySelectorAll('a')];

		if (event.key === 'Escape') {
			results.classList.remove('open');
			input.blur();
			return;
		}

		if (!items.length) return;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
			items.forEach((a, i) => a.classList.toggle('active', i === selected));
			items[selected].scrollIntoView({ block: 'nearest' });
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			(items[selected] || items[0]).click();
		}
	});

	document.addEventListener('click', (event) => {
		if (!topbar.querySelector('.search').contains(event.target)) results.classList.remove('open');
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
			event.preventDefault();
			input.focus();
		}
	});
})();
