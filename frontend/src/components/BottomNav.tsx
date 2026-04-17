/**
 * BottomNav - Figma Design System
 * 4-tab bottom navigation bar with glassmorphism effect
 * Tabs: Home, Explore, History, Account
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '@/utils/haptic'

const tabs = [
  { icon: 'home', label: 'Home', path: '/' },
  { icon: 'search', label: 'Explore', path: '/marketplace' },
  { icon: 'history', label: 'History', path: '/partnerships' },
  { icon: 'settings', label: 'Account', path: '/account' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  // Determine active tab based on current path
  const getIsActive = (tabPath: string) => {
    if (tabPath === '/') {
      return location.pathname === '/' || 
             location.pathname === '/advertiser' || 
             location.pathname === '/channel-owner'
    }
    return location.pathname.startsWith(tabPath)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-8 h-[80px] border-t border-[#1e293b]"
      style={{
        background: 'rgba(16, 25, 34, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = getIsActive(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => {
              haptic.light()
              navigate(tab.path)
            }}
            className="flex flex-col items-center gap-1 min-w-[56px] transition-colors duration-200"
          >
            <span
              className="material-icons-round text-[24px]"
              style={{ color: isActive ? '#137fec' : '#64748b' }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[10px] font-bold"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: isActive ? '#137fec' : '#94a3b8',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
