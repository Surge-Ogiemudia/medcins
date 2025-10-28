import React from "react";
// Fallback SVG chat icon
import Button from '@mui/material/Button';

export default function SupportChatButton({ onClick }) {
  return (
    <Button
      variant="contained"
      color="primary"
      onClick={onClick}
      sx={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        zIndex: 2000,
        borderRadius: '50%',
        minWidth: 0,
        width: 64,
        height: 64,
        boxShadow: 4,
        p: 0,
        fontSize: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="Support Chat"
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </Button>
  );
}
