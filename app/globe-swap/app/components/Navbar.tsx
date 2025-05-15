// components/Navbar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function Navbar() {
  const pathname = usePathname()

  const navLinks = [
    { name: 'Create Trade', href: '/create-trade' },
    { name: 'Browse Trades', href: '/browse-trades' },
    { name: 'History', href: '/history' },
  ]

  return (
    <nav className="luxury-navbar">
      <div className="navbar-logo">
        <Link href="/" className="text-2xl font-bold">
          GlobeSwap
        </Link>
      </div>
      
      <div className="navbar-links">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
          >
            {link.name}
          </Link>
        ))}
      </div>

      <div className="navbar-wallet">
        <WalletMultiButton />
      </div>
    </nav>
  )
}