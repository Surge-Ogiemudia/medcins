import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // MUI default blue, can be customized
    },
    secondary: {
      main: '#7c3aed', // Custom purple for accent
    },
    background: {
      default: '#f4f6fa',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
});

export default theme;
