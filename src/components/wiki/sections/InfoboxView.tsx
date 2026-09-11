import type { InfoboxSection } from '../../../types/wiki';
import { RichOrPlainText } from '../../card/CardRichText';
import styles from './InfoboxView.module.css';
interface InfoboxViewProps {
    section: InfoboxSection;
}
export function InfoboxView({ section }: InfoboxViewProps) {
    return (<aside className={styles.infobox} style={section.borderColor ? { borderColor: section.borderColor } : undefined}>
      {section.characterName && (<h3 className={styles.name} style={section.nameColor ? { color: section.nameColor } : undefined}>{section.characterName}</h3>)}
      {section.portraitUrl && (<div className={styles.portraitWrap}>
          <img src={section.portraitUrl} alt={section.characterName} className={styles.portrait}/>
        </div>)}
      {section.subtitle && (<div className={styles.subtitle}>{section.subtitle}</div>)}
      {section.fields.length > 0 && (<table className={styles.table}>
          <tbody>
            {section.fields.map((field, i) => (field.isHeader ? (<tr key={i} className={styles.headerRow}>
                  <td colSpan={2} className={styles.sectionHeader} style={section.nameColor ? { color: section.nameColor } : undefined}>
                    {field.label}
                  </td>
                </tr>) : (<tr key={i} className={styles.row}>
                  <th className={styles.label} style={section.labelColor ? { color: section.labelColor } : undefined}>{field.label}</th>
                  <td className={styles.value}><RichOrPlainText content={field.value}/></td>
                </tr>)))}
          </tbody>
        </table>)}
    </aside>);
}
