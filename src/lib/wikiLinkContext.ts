import { createContext } from 'react';
export const ExistingSlugsContext = createContext<Set<string> | null>(null);
