import { AccountView } from './components/AccountView';
import { CollectionView } from './components/CollectionView';
import { DatabaseView } from './components/DatabaseView';
import { HelpView } from './components/HelpView';
import { HistoryView } from './components/HistoryView';
import { Layout } from './components/Layout';
import { ScannerView } from './components/ScannerView';
import { useAppState } from './state/AppState';

export default function App() {
  const { view } = useAppState();
  return <Layout>
    {view === 'scanner' && <ScannerView />}
    {view === 'collection' && <CollectionView />}
    {view === 'account' && <AccountView />}
    {view === 'history' && <HistoryView />}
    {view === 'database' && <DatabaseView />}
    {view === 'help' && <HelpView />}
  </Layout>;
}
