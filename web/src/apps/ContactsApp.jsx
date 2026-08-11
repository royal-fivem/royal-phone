import React from 'react';

import { ContactsTab, PhoneNav, useDial } from './DialerApp';

/**
 * Contacts, on its own icon.
 *
 * Deliberately not a second implementation: it mounts the exact screen the Phone
 * app used to show inline, and the same bottom navigation. Calls and Keypad tap
 * straight back into the Phone app, Messages into Messages — four slots across
 * three apps, so the bar reads the same wherever you are standing.
 *
 * A call started here is not `minimized`, so it hands over to the global call
 * overlay: this app has no call screen of its own, and a minimised call would
 * show nothing but the status-bar chip.
 */
export default function ContactsApp() {
	const dial = useDial();

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<ContactsTab onDial={dial} />

			<PhoneNav active="contacts" />
		</div>
	);
}
