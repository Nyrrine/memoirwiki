import type { StatTableSection } from '../../../types/wiki';
import { RichOrPlainText } from '../../card/CardRichText';
import styles from './StatTableView.module.css';
interface StatTableViewProps {
    section: StatTableSection;
}
export function StatTableView({ section }: StatTableViewProps) {
    if (section.rows.length === 0)
        return null;
    return (<div className={styles.section}>
      {section.heading && <h2 className={styles.heading} style={section.headingColor ? { color: section.headingColor } : undefined}>{section.heading}</h2>}
      <table className={styles.table}>
        <tbody>
          {section.rows.map((row, i) => (<tr key={i} className={styles.row}>
              <th className={styles.label} style={section.labelColor ? { color: section.labelColor } : undefined}>{row.label}</th>
              <td className={styles.value} style={row.color ? { color: row.color } : undefined}>
                <RichOrPlainText content={row.value}/>
              </td>
            </tr>))}
        </tbody>
      </table>
    </div>);
}
