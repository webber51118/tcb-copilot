import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initLiff } from './services/liff';
import './index.css';

async function bootstrap() {
  try {
    await initLiff();
  } catch (err) {
    console.error('[LIFF] 初始化失敗：', err);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
