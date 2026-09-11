import type { ImageGallerySection } from '../../../types/wiki';
import { isRichContent, isSlateEmpty, slateToPlainText } from '../../../lib/slateHelpers';
import { RichOrPlainText } from '../../card/CardRichText';
import styles from './ImageGalleryView.module.css';
interface ImageGalleryViewProps {
    section: ImageGallerySection;
}
function hasCaption(caption: ImageGallerySection['images'][number]['caption']): boolean {
    if (isRichContent(caption))
        return !isSlateEmpty(caption);
    return !!caption;
}
function captionAlt(caption: ImageGallerySection['images'][number]['caption']): string {
    if (isRichContent(caption))
        return slateToPlainText(caption);
    return typeof caption === 'string' ? caption : '';
}
export function ImageGalleryView({ section }: ImageGalleryViewProps) {
    if (section.images.length === 0)
        return null;
    return (<div className={styles.section}>
      {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
      <div className={styles.grid}>
        {section.images.map((img, i) => (<figure key={i} className={styles.figure}>
            <img src={img.url} alt={captionAlt(img.caption)} className={styles.image}/>
            {hasCaption(img.caption) && (<figcaption className={styles.caption}>
                <RichOrPlainText content={img.caption}/>
              </figcaption>)}
          </figure>))}
      </div>
    </div>);
}
