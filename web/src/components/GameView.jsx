import React, { useEffect, useRef, useState } from 'react';

import { MainRender } from '../utils/cameraAdapter';
import isEnvBrowser from '../utils/isEnvBrowser';

export async function captureGameImage() {
	try {
		return MainRender.canvas ? await MainRender.captureImage() : null;
	} catch (error) {
		console.error('[royal-phone] capture failed', error);
		return null;
	}
}

export default function GameView({ visible = true }) {
	const hostRef = useRef(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const host = hostRef.current;
		if (!host || isEnvBrowser()) {
			setFailed(true);
			return;
		}

		try {
			MainRender.initializeAgain();
			MainRender.renderToTarget();
			MainRender.resize(false);

			const canvas = MainRender.canvas;
			canvas.style.width = '100%';
			canvas.style.height = '100%';
			canvas.style.objectFit = 'cover';
			canvas.style.display = 'block';

			host.appendChild(canvas);
		} catch (error) {
			console.error('[royal-phone] game render unavailable', error);
			setFailed(true);
		}

		return () => MainRender.stop();
	}, []);

	useEffect(() => {
		if (failed) return;

		const onResize = () => {
			try {
				MainRender.resize(false);
			} catch {
				// A bad frame, not a dead viewfinder.
			}
		};

		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [failed]);

	if (failed) return null;

	return (
		<div
			ref={hostRef}
			className={`absolute inset-0 overflow-hidden bg-black ${visible ? '' : 'invisible'}`}
		/>
	);
}
