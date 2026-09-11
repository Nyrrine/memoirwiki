import type { Descendant } from 'slate';
import type { ImageGallerySection, GalleryImage } from '../../../types/wiki';
import { EMPTY_SLATE_VALUE, toSlateValue } from '../../../lib/slateHelpers';
import { SlateEditor } from '../../editor/SlateEditor';
import styles from './EditorFields.module.css';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 20;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
interface ImageGalleryEditorProps {
    section: ImageGallerySection;
    onUpdate: (patch: Partial<ImageGallerySection>) => void;
}
export function ImageGalleryEditor({ section, onUpdate }: ImageGalleryEditorProps) {
    const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('Image must be under 10 MB');
            return;
        }
        const newImage: GalleryImage = {
            id: crypto.randomUUID(), url: URL.createObjectURL(file), caption: EMPTY_SLATE_VALUE,
        };
        onUpdate({ images: [...section.images, newImage] });
        e.target.value = '';
    };
    const updateImage = (index: number, patch: Partial<GalleryImage>) => {
        const images = [...section.images];
        images[index] = { ...images[index], ...patch };
        onUpdate({ images });
    };
    const removeImage = (index: number) => {
        onUpdate({ images: section.images.filter((_, i) => i !== index) });
    };
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Heading</label>
      <input className={styles.input} value={section.heading} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="Section heading (optional)" maxLength={200}/>

      <label className={styles.label}>Images</label>
      {section.images.map((img, i) => (<div key={i} className={styles.fieldRow}>
          <img src={img.url} alt="" className={styles.previewSmall}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SlateEditor compact value={toSlateValue(img.caption)} onChange={(val: Descendant[]) => updateImage(i, { caption: val })} placeholder="Caption - :token: [keyword]"/>
          </div>
          <button type="button" className={styles.removeBtn} onClick={() => removeImage(i)}>✕</button>
        </div>))}
      {section.images.length >= MAX_IMAGES ? (<p className={styles.hint}>Image limit reached ({MAX_IMAGES})</p>) : (<input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleAdd} className={styles.fileInput}/>)}
    </div>);
}
