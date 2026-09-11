import type { QuoteSection } from '../../../types/wiki';
import { isRichContent, isSlateEmpty } from '../../../lib/slateHelpers';
import { CardRichText } from '../../card/CardRichText';
import styles from './QuoteView.module.css';
interface QuoteViewProps {
    section: QuoteSection;
}
export function QuoteView({ section }: QuoteViewProps) {
    const isEmpty = isRichContent(section.text)
        ? isSlateEmpty(section.text)
        : !section.text;
    if (isEmpty)
        return null;
    return (<blockquote className={styles.quote} style={section.borderColor ? { borderLeftColor: section.borderColor } : undefined}>
      {isRichContent(section.text) ? (<div className={styles.text} style={section.textColor ? { color: section.textColor } : undefined}>
          <CardRichText content={section.text}/>
        </div>) : (<p className={styles.text} style={section.textColor ? { color: section.textColor } : undefined}>{section.text}</p>)}
      {section.attribution && (<cite className={styles.attribution} style={section.attributionColor ? { color: section.attributionColor } : undefined}>— {section.attribution}</cite>)}
    </blockquote>);
}
