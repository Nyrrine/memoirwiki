import type { WikiSection, WikiPageProject } from '../../../types/wiki';
import type { SavedProjectMeta } from '../../../lib/projectPersistence';
import { InfoboxView } from './InfoboxView';
import { RichTextSectionView } from './RichTextSectionView';
import { IdentityShowcaseView } from './IdentityShowcaseView';
import { ImageGalleryView } from './ImageGalleryView';
import { CollapsibleView } from './CollapsibleView';
import { DividerView } from './DividerView';
import { QuoteView } from './QuoteView';
import { StatTableView } from './StatTableView';
interface SectionRendererProps {
    section: WikiSection;
    linkedProjects?: WikiPageProject[];
    projectMetas?: SavedProjectMeta[];
    pageSlug?: string;
    onIdentityClick?: (projectId: string, wikiPageProjectId: string) => void;
}
export function SectionRenderer({ section, linkedProjects, projectMetas, pageSlug, onIdentityClick, }: SectionRendererProps) {
    switch (section.type) {
        case 'infobox':
            return <InfoboxView section={section}/>;
        case 'richtext':
            return <RichTextSectionView section={section}/>;
        case 'identity-showcase':
            return (<IdentityShowcaseView section={section} linkedProjects={linkedProjects || []} projectMetas={projectMetas || []} pageSlug={pageSlug} onIdentityClick={onIdentityClick}/>);
        case 'image-gallery':
            return <ImageGalleryView section={section}/>;
        case 'collapsible':
            return <CollapsibleView section={section}/>;
        case 'divider':
            return <DividerView section={section}/>;
        case 'quote':
            return <QuoteView section={section}/>;
        case 'stat-table':
            return <StatTableView section={section}/>;
        default:
            return null;
    }
}
