import type { WikiSection } from '../../../types/wiki';
import { InfoboxEditor } from './InfoboxEditor';
import { RichTextSectionEditor } from './RichTextSectionEditor';
import { IdentityShowcaseEditor } from './IdentityShowcaseEditor';
import { ImageGalleryEditor } from './ImageGalleryEditor';
import { CollapsibleEditor } from './CollapsibleEditor';
import { DividerEditor } from './DividerEditor';
import { QuoteEditor } from './QuoteEditor';
import { StatTableEditor } from './StatTableEditor';
import styles from './SectionEditor.module.css';
interface SectionEditorProps {
    section: WikiSection;
    index: number;
    totalSections: number;
    collapsed: boolean;
    onUpdate: (id: string, patch: Partial<WikiSection>) => void;
    onRemove: (id: string) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onToggleCollapse: () => void;
    onLinkIdentities?: () => void;
    onDragStart: (index: number) => void;
    onDragOver: (e: React.DragEvent, index: number) => void;
    onDrop: (e: React.DragEvent, index: number) => void;
    onDragEnd: () => void;
    isDragOver: boolean;
    isDragging: boolean;
}
const TYPE_LABELS: Record<string, string> = {
    infobox: 'INFOBOX',
    richtext: 'RICH TEXT',
    'identity-showcase': 'IDENTITY SHOWCASE',
    'image-gallery': 'IMAGE GALLERY',
    collapsible: 'COLLAPSIBLE',
    divider: 'DIVIDER',
    quote: 'QUOTE',
    'stat-table': 'STAT TABLE',
};
export function SectionEditor({ section, index, totalSections, collapsed, onUpdate, onRemove, onMoveUp, onMoveDown, onToggleCollapse, onLinkIdentities, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, isDragging, }: SectionEditorProps) {
    const renderEditor = () => {
        switch (section.type) {
            case 'infobox':
                return <InfoboxEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'richtext':
                return <RichTextSectionEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'identity-showcase':
                return <IdentityShowcaseEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)} onLinkIdentities={onLinkIdentities}/>;
            case 'image-gallery':
                return <ImageGalleryEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'collapsible':
                return <CollapsibleEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'divider':
                return <DividerEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'quote':
                return <QuoteEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            case 'stat-table':
                return <StatTableEditor section={section} onUpdate={(patch) => onUpdate(section.id, patch)}/>;
            default:
                return null;
        }
    };
    return (<div className={`${styles.editor} ${isDragging ? styles.dragging : ''} ${isDragOver ? styles.dragOver : ''}`} draggable onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            onDragStart(index);
        }} onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            onDragOver(e, index);
        }} onDrop={(e) => onDrop(e, index)} onDragEnd={onDragEnd}>
      <div className={styles.header} onClick={onToggleCollapse}>
        <div className={styles.headerLeft}>
          <span className={styles.dragHandle} onClick={(e) => e.stopPropagation()} title="Drag to reorder">&#x2801;&#x2801;</span>
          <span className={styles.collapseIcon}>{collapsed ? '+' : '\u2212'}</span>
          <span className={styles.typeLabel}>{TYPE_LABELS[section.type] || section.type}</span>
        </div>
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.actionBtn} onClick={onMoveUp} disabled={index === 0} title="Move up">&uarr;</button>
          <button type="button" className={styles.actionBtn} onClick={onMoveDown} disabled={index === totalSections - 1} title="Move down">&darr;</button>
          <button type="button" className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onRemove(section.id)} title="Remove section">&times;</button>
        </div>
      </div>
      <div className={`${styles.body} ${collapsed ? styles.bodyCollapsed : ''}`}>
        {renderEditor()}
      </div>
    </div>);
}
