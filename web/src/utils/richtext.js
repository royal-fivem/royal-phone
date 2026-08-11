/**
 * Rich text sanitising for the Documents editor.
 *
 * A document is written by one player and read by everyone invited to it, so
 * its HTML is untrusted input on the way back out of the database. Everything
 * is rebuilt from a fixed allow-list rather than filtered — an allow-list can
 * only ever be too strict, whereas a blocklist is one unknown attribute away
 * from executing someone else's script inside the NUI.
 */

const ALLOWED_TAGS = new Set([
	'P', 'BR', 'DIV',
	'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
	'H1', 'H2', 'H3',
	'UL', 'OL', 'LI',
	'BLOCKQUOTE', 'CODE', 'PRE',
	'SPAN',
]);

/** Tags that carry nothing we want to keep, content included. */
const DROP_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'FORM', 'INPUT', 'BUTTON']);

/** Rewritten rather than dropped, so old execCommand output survives. */
const REMAP = { STRIKE: 'S', DEL: 'S', DIV: 'P' };

const clone = (node, doc) => {
	if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.nodeValue);
	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	if (DROP_ENTIRELY.has(node.tagName)) return null;

	// Anything not on the list contributes its children but not itself, so a
	// stray <a> or <img> loses its wrapper without swallowing the paragraph.
	const keep = ALLOWED_TAGS.has(node.tagName);
	const tag = REMAP[node.tagName] ?? node.tagName;
	const target = keep ? doc.createElement(tag) : doc.createDocumentFragment();

	for (const child of node.childNodes) {
		const copy = clone(child, doc);
		if (copy) target.appendChild(copy);
	}

	return target;
};

/** Strip a document body down to the allowed tags. Attributes never survive. */
export const sanitizeHtml = (html) => {
	if (typeof html !== 'string' || html === '') return '';

	const doc = document.implementation.createHTMLDocument('');
	doc.body.innerHTML = html;

	const out = doc.createElement('div');
	for (const child of [...doc.body.childNodes]) {
		const copy = clone(child, doc);
		if (copy) out.appendChild(copy);
	}

	return out.innerHTML;
};

const BLOCK_LEVEL = 'P,H1,H2,H3,LI,BLOCKQUOTE,PRE,BR';

/**
 * Plain text, for list previews and the empty check. `textContent` alone runs
 * blocks together — "Stock on handCounted after…" — so block boundaries become
 * spaces first.
 */
export const toPlainText = (html) => {
	const doc = document.implementation.createHTMLDocument('');
	doc.body.innerHTML = sanitizeHtml(html);

	for (const node of doc.body.querySelectorAll(BLOCK_LEVEL)) {
		node.insertAdjacentText('beforebegin', ' ');
	}

	return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

/** Rough word count for the document's footer. */
export const countWords = (html) => {
	const text = toPlainText(html);
	return text ? text.split(' ').length : 0;
};
