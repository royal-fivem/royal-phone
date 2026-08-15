const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatClock = (hour, minute) => {
	const suffix = hour >= 12 ? 'PM' : 'AM';
	const twelve = hour % 12 === 0 ? 12 : hour % 12;
	return `${String(twelve).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
};

export const formatDate = (day, date, month) =>
	`${DAYS[day % 7] ?? 'Monday'}, ${MONTHS[(month - 1) % 12] ?? 'Jan'} ${date}`;

export const formatRelative = (timestamp) => {
	if (!timestamp) return '';

	const diff = Date.now() - timestamp;
	if (diff < 60_000) return 'now';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
	if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;

	return new Date(timestamp).toLocaleDateString();
};

export const formatTime = (timestamp) =>
	new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatMoney = (value) =>
	`$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const dayIndex = (timestamp) => {
	const date = new Date(timestamp);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
};

export const formatDayDivider = (timestamp) => {
	const day = dayIndex(timestamp);
	const today = dayIndex(Date.now());
	const daysAgo = Math.round((today - day) / 86_400_000);

	if (daysAgo <= 0) return 'TODAY';
	if (daysAgo === 1) return 'YESTERDAY';
	if (daysAgo < 7) return DAYS[new Date(timestamp).getDay()].toUpperCase();

	return new Date(timestamp)
		.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
		.toUpperCase();
};

export const startsNewDay = (timestamp, previous) =>
	previous == null || dayIndex(timestamp) !== dayIndex(previous);
