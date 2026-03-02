import React from 'react';
import HeroAscii from './HeroAscii.jsx';

/**
 * Hero — delegates to HeroAscii which provides the full hero section
 * with ASCII shield animation, counter badge, CTA, and i18n text.
 */
export default function Hero() {
  return <HeroAscii />;
}
