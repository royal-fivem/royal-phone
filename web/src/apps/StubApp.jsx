import React from 'react';
import { motion } from 'framer-motion';

import AppGlyph from '../components/AppGlyph';

/**
 * Placeholder for apps that are on the home screen but have no screen yet.
 * Give the entry a `component` in `web/src/config/apps.jsx` to replace it.
 */
export default function StubApp({ app }) {
	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-5 px-8 text-center"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: 'spring', stiffness: 320, damping: 30 }}
				className="h-24 w-24"
			>
				<AppGlyph app={app} radius="26%" glyph="46%" />
			</motion.div>

			<div>
				<h2 className="text-[22px] font-bold text-white">{app.label}</h2>

				<div className="mt-1.5 flex items-center justify-center gap-1 text-[14px] text-white/40">
					<span>Coming soon</span>

					{[0, 1, 2].map((index) => (
						<motion.span
							key={index}
							className="text-[14px] leading-none"
							animate={{ opacity: [0.15, 1, 0.15] }}
							transition={{
								duration: 1.35,
								repeat: Infinity,
								ease: 'easeInOut',
								delay: index * 0.18,
							}}
						>
							.
						</motion.span>
					))}
				</div>
			</div>
		</div>
	);
}
