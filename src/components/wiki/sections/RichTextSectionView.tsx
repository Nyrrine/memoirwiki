import type { RichTextSection } from '../../../types/wiki';
import { CardRichText } from '../../card/CardRichText';
import styles from './RichTextSectionView.module.css';
interface RichTextSectionViewProps {
    section: RichTextSection;
}
export function RichTextSectionView({ section }: RichTextSectionViewProps) {
    return (<div className={styles.section}>
      {section.heading && (<h2 className={styles.heading} style={section.headingColor ? { color: section.headingColor } : undefined}>{section.heading}</h2>)}
      <div className={styles.content}>
        <CardRichText content={section.content}/>
      </div>
    </div>);
}
