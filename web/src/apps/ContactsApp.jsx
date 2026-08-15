import React from 'react';

import { ContactsTab, PhoneNav, useDial } from './DialerApp';

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
