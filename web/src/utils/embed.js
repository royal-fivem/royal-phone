/**
 * Works out what a pasted link actually is, so a post can render it rather than
 * showing a raw URL: a picture, a video file, or a YouTube player.
 */

const YOUTUBE = [
	/youtu\.be\/([\w-]{6,})/i,
	/youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
	/youtube\.com\/embed\/([\w-]{6,})/i,
	/youtube\.com\/shorts\/([\w-]{6,})/i,
];

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i;
const VIDEO = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

/**
 * @param {string} value a URL or data URI
 * @returns {{ kind: 'image'|'video'|'youtube'|'link', url: string, id?: string }|null}
 */
export function parseMedia(value) {
	const url = (value ?? '').trim();
	if (!url) return null;

	// Gallery shots arrive as data URIs and are always images.
	if (url.startsWith('data:image/')) return { kind: 'image', url };
	if (url.startsWith('data:video/')) return { kind: 'video', url };

	for (const pattern of YOUTUBE) {
		const match = url.match(pattern);
		if (match) return { kind: 'youtube', url, id: match[1] };
	}

	if (IMAGE.test(url)) return { kind: 'image', url };
	if (VIDEO.test(url)) return { kind: 'video', url };

	return { kind: 'link', url };
}

/** Privacy-friendly host, and the one that allows embedding without cookies. */
export const youtubeEmbed = (id) =>
	`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** First URL found in a block of text, if any. */
export const firstLink = (text) => (text ?? '').match(/https?:\/\/\S+/i)?.[0] ?? null;
