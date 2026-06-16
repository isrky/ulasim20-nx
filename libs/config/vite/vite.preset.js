import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { qrcode } from 'vite-plugin-qrcode';

const isRemote = process.env.REMOTE === 'true';

export const plugins = [react(), tailwindcss(), ...(!isRemote ? [basicSsl()] : []), qrcode()];

export const server = {
  allowedHosts: true,
  host: true,
  port: 3080,
  open: !isRemote
};
