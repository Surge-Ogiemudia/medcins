import React from "react";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

export default function FooterNav() {
  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        bgcolor: '#f4f6fa',
        borderTop: '1px solid #e0e7ef',
        py: 3,
        mt: 8,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 2, sm: 6 },
        fontSize: 15,
      }}
    >
      <Typography color="primary" fontWeight={700}>
        Pharmastack &copy; {new Date().getFullYear()}
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, mt: { xs: 2, sm: 0 } }}>
        <Link href="/" underline="hover" color="inherit">Home</Link>
        <Link href="/shop" underline="hover" color="inherit">Shop</Link>
        <Link href="/store" underline="hover" color="inherit">Pharmacies</Link>
        <Link href="/auth" underline="hover" color="inherit">Login</Link>
  <Link href="mailto:pharmastack@gmail.com" underline="hover" color="inherit">Contact</Link>
      </Box>
    </Box>
  );
}
