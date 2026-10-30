import React from 'react'

const S = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
)

export const Ic = {
  // برند
  Logo: p => <S {...p}><path d="M3 17c3-9 6 4 9-5s3 8 9 2" strokeWidth="2.4" /></S>,
  // منو
  Dashboard: p => <S {...p}><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></S>,
  Tunnel: p => <S {...p}><path d="M4 8h4a4 4 0 0 1 0 8H4" /><path d="M20 8h-4a4 4 0 0 0 0 8h4" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /></S>,
  Server: p => <S {...p}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" strokeWidth="2.6" /></S>,
  Users: p => <S {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></S>,
  Settings: p => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></S>,
  Logout: p => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></S>,
  Menu: p => <S {...p}><path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2.2" /></S>,
  // اکشن
  Plus: p => <S {...p}><path d="M12 5v14M5 12h14" strokeWidth="2.2" /></S>,
  Trash: p => <S {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></S>,
  Edit: p => <S {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></S>,
  Copy: p => <S {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>,
  Check: p => <S {...p} strokeWidth="3"><path d="M20 6L9 17l-5-5" /></S>,
  X: p => <S {...p} strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></S>,
  Refresh: p => <S {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></S>,
  Search: p => <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></S>,
  Play: p => <S {...p}><path d="M6 4l14 8-14 8z" fill="currentColor" /></S>,
  // وضعیت
  Activity: p => <S {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeWidth="2.1" /></S>,
  Bolt: p => <S {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9z" /></S>,
  Link: p => <S {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></S>,
  Shield: p => <S {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></S>,
  Lock: p => <S {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></S>,
  Globe: p => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></S>,
  Clock: p => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  Cpu: p => <S {...p}><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></S>,
  Memory: p => <S {...p}><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 17v3M12 17v3M17 17v3M7 12h.01M11 12h.01M15 12h.01" /></S>,
  Down: p => <S {...p}><path d="M12 5v14M19 12l-7 7-7-7" strokeWidth="2.1" /></S>,
  Up: p => <S {...p}><path d="M12 19V5M5 12l7-7 7 7" strokeWidth="2.1" /></S>,
  Wifi: p => <S {...p}><path d="M5 12.55a11 11 0 0 1 14 0M2 8.8a16 16 0 0 1 20 0M8.5 16.4a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" /></S>,
  Info: p => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" strokeWidth="2.2" /></S>,
  Alert: p => <S {...p}><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" strokeWidth="2.2" /></S>,
  Inbox: p => <S {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" /></S>,
  Save: p => <S {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></S>,
  Download: p => <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></S>,
  Arrow: p => <S {...p} strokeWidth="2.1"><path d="M19 12H5M12 19l-7-7 7-7" /></S>,
}
