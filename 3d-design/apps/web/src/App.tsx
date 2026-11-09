import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './components/layout/AppShell';

// three.js lives only in these chunks; the shell and library stay light.
const Home = lazy(() => import('./pages/Home'));
const Create = lazy(() => import('./pages/Create'));
const Share = lazy(() => import('./pages/Share'));
const Library = lazy(() => import('./pages/Library'));
const Legal = lazy(() => import('./pages/Legal'));
const NotFound = lazy(() => import('./pages/NotFound'));

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/create', element: <Create /> },
      { path: '/library', element: <Library /> },
      { path: '/s/:slug', element: <Share /> },
      { path: '/terms', element: <Legal doc="terms" /> },
      { path: '/privacy', element: <Legal doc="privacy" /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
