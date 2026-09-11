import { useState } from 'react';
import { WikiLayout } from './WikiLayout';
import { WikiBrowser } from './WikiBrowser';
import { wikiSearchPlaceholder } from '../../lib/wikiKinds';
import { Input } from '../ui';
export function WikiHome() {
    const [search, setSearch] = useState('');
    return (<WikiLayout headerSearch={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={wikiSearchPlaceholder('all')} aria-label="Search the wiki"/>}>
      <WikiBrowser search={search} onSearchChange={setSearch}/>
    </WikiLayout>);
}
