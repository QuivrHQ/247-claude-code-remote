/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-geist-sans)', 'Geist', 'system-ui', 'sans-serif'],
  			mono: ['var(--font-geist-mono)', 'Geist Mono', 'monospace'],
  			display: ['var(--font-geist-sans)', 'Geist', 'system-ui', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius-lg)',
  			md: 'var(--radius)',
  			sm: 'var(--radius-sm)',
  			xl: 'var(--radius-xl)',
  		},
  		colors: {
  			/* ═══════════════════════════════════════════════════════════════════
  			   OKLCH Color System - Variables are complete color values
  			   ═══════════════════════════════════════════════════════════════════ */
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			'foreground-muted': 'var(--foreground-muted)',
  			'foreground-subtle': 'var(--foreground-subtle)',
  			surface: {
  				0: 'var(--surface-0)',
  				1: 'var(--surface-1)',
  				2: 'var(--surface-2)',
  				3: 'var(--surface-3)',
  			},
  			status: {
  				working: 'var(--status-working)',
  				attention: 'var(--status-attention)',
  				permission: 'var(--status-permission)',
  				success: 'var(--status-success)',
  				idle: 'var(--status-idle)',
  				error: 'var(--status-error)',
  			},
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)',
  				hover: 'var(--primary-hover)',
  				muted: 'var(--primary-muted)',
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)',
  				blue: 'var(--accent-blue)',
  				purple: 'var(--accent-purple)',
  				emerald: 'var(--accent-emerald)',
  				amber: 'var(--accent-amber)',
  				rose: 'var(--accent-rose)',
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)'
  			},
  			border: 'var(--border)',
  			'border-subtle': 'var(--border-subtle)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
  			chart: {
  				'1': 'var(--chart-1)',
  				'2': 'var(--chart-2)',
  				'3': 'var(--chart-3)',
  				'4': 'var(--chart-4)',
  				'5': 'var(--chart-5)'
  			}
  		},
  		boxShadow: {
  			'glow-orange': 'var(--shadow-glow-orange)',
  			'glow-blue': 'var(--shadow-glow-blue)',
  			'glow-purple': 'var(--shadow-glow-purple)',
  			'glow-emerald': 'var(--shadow-glow-emerald)',
  		},
  		animation: {
  			'status-pulse': 'status-pulse 2s ease-out infinite',
  			'fade-in-up': 'fade-in-up var(--duration-normal) var(--ease-out) forwards',
  			'slide-in-left': 'slide-in-left var(--duration-normal) var(--ease-out) forwards',
  			'scale-in': 'scale-in var(--duration-fast) var(--ease-spring) forwards',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
