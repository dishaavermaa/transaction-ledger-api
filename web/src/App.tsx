import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { TransferPage } from './pages/TransferPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <AccountsPage /> },
      { path: 'accounts/:accountId', element: <AccountDetailPage /> },
      { path: 'transfer', element: <TransferPage /> },
    ],
  },
]);
