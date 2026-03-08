import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { EntryDetail } from './pages/EntryDetail';
import { Search } from './pages/Search';
import { Tags } from './pages/Tags';
import { Settings } from './pages/Settings';
import { Timeline } from './pages/Timeline';
import './index.css';

const queryClient = new QueryClient();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Timeline />} />
              <Route path="entry/:id" element={<EntryDetail />} />
              <Route path="search" element={<Search />} />
              <Route path="tags" element={<Tags />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
