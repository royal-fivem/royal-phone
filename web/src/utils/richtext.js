

const ALLOWED_TAGS = new Set([
	'P', 'BR', 'DIV',
	'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
	'H1', 'H2', 'H3',
	'UL', 'OL', 'LI',
	'BLOCKQUOTE', 'CODE', 'PRE',
	'SPAN',
]);

const DROP_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'FORM', 'INPUT', 'BUTTON']);

const REMAP = { STRIKE: 'S', DEL: 'S', DIV: 'P' };

const clone = (node, doc) => {
	if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.nodeValue);
	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	if (DROP_ENTIRELY.has(node.tagName)) return null;

	const keep = ALLOWED_TAGS.has(node.tagName);
	const tag = REMAP[node.tagName] ?? node.tagName;
	const target = keep ? doc.createElement(tag) : doc.createDocumentFragment();

	for (const child of node.childNodes) {
		const copy = clone(child, doc);
		if (copy) target.appendChild(copy);
	}

	return target;
};

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

export const toPlainText = (html) => {
	const doc = document.implementation.createHTMLDocument('');
	doc.body.innerHTML = sanitizeHtml(html);

	for (const node of doc.body.querySelectorAll(BLOCK_LEVEL)) {
		node.insertAdjacentText('beforebegin', ' ');
	}

	return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

export const countWords = (html) => {
	const text = toPlainText(html);
	return text ? text.split(' ').length : 0;
};
