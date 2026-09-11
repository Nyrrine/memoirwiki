import { memo } from 'react';
import type { ProjectData } from '../../types/project';
import { CardPage } from './CardPage';
interface CardRendererProps {
    data: ProjectData;
    pageIndex?: number;
    totalPages?: number;
    leftTab?: 'info' | 'sanity';
    onTabChange?: (tab: 'info' | 'sanity') => void;
    layout?: 'paged' | 'single';
}
export const CardRenderer = memo(function CardRenderer({ data, pageIndex = 0, totalPages = 1, leftTab = 'info', onTabChange, layout = 'paged' }: CardRendererProps) {
    return <CardPage data={data} pageIndex={pageIndex} totalPages={totalPages} leftTab={leftTab} onTabChange={onTabChange} layout={layout}/>;
});
