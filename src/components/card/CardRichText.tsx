import { useContext } from 'react';
import type { Descendant } from 'slate';
import { Link } from 'react-router-dom';
import { ExistingSlugsContext } from '../../lib/wikiLinkContext';
import { getCategoryColor, getTokenDef } from '../../lib/tokens';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import type { CustomStatus } from '../../types/customStatus';
import { findKeywords } from '../../lib/keywords';
import { isRichContent } from '../../lib/slateHelpers';
import styles from './CardRichText.module.css';
interface CardRichTextProps {
    content: Descendant[];
}
interface SlateElement {
    type?: string;
    tokenKey?: string;
    children?: SlateNode[];
}
interface SlateText {
    text: string;
    bold?: boolean;
    italic?: boolean;
    color?: string;
}
type SlateNode = SlateElement | SlateText;
function isText(node: SlateNode): node is SlateText {
    return 'text' in node;
}
function renderTextWithKeywords(text: string, key: number): React.ReactNode {
    const decorations: {
        start: number;
        end: number;
        type: 'keyword' | 'color';
        color: string;
        innerStart?: number;
        innerEnd?: number;
    }[] = [];
    const kwMatches = findKeywords(text);
    for (const m of kwMatches) {
        decorations.push({ start: m.start, end: m.end, type: 'keyword', color: m.color });
    }
    const colorRegex = /\{(#[0-9a-fA-F]{3,6}):([^}]+)\}/g;
    let match;
    while ((match = colorRegex.exec(text)) !== null) {
        const hexColor = match[1];
        const innerText = match[2];
        const fullStart = match.index;
        const innerStart = fullStart + 1 + hexColor.length + 1;
        const innerEnd = innerStart + innerText.length;
        decorations.push({ start: fullStart, end: innerEnd + 1, type: 'color', color: hexColor, innerStart, innerEnd });
    }
    if (decorations.length === 0)
        return text;
    decorations.sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (let i = 0; i < decorations.length; i++) {
        const d = decorations[i];
        if (d.start > cursor) {
            parts.push(text.slice(cursor, d.start));
        }
        if (d.type === 'keyword') {
            parts.push(<span key={`${key}-kw-${i}`} className={styles.keyword} style={{ color: d.color }}>
          {text.slice(d.start, d.end)}
        </span>);
        }
        else if (d.type === 'color' && d.innerStart !== undefined && d.innerEnd !== undefined) {
            parts.push(<span key={`${key}-clr-${i}`} style={{ color: d.color }}>
          {text.slice(d.innerStart, d.innerEnd)}
        </span>);
        }
        cursor = d.end;
    }
    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }
    return <>{parts}</>;
}
function renderNode(node: SlateNode, key: number, customStatuses: CustomStatus[] = []): React.ReactNode {
    if (isText(node)) {
        let el: React.ReactNode = renderTextWithKeywords(node.text, key);
        if (node.bold)
            el = <strong key={key}>{el}</strong>;
        if (node.italic)
            el = <em key={key}>{el}</em>;
        return <span key={key}>{el}</span>;
    }
    const element = node as SlateElement;
    if (element.type === 'token' && element.tokenKey) {
        const token = getTokenDef(element.tokenKey, customStatuses);
        if (!token)
            return <span key={key} className={styles.unknownToken}>[{element.tokenKey}]</span>;
        const instanceColor = (element as {
            color?: string;
        }).color;
        if (token.category === 'count' && !instanceColor) {
            const parentKey = token.key.replace(/_count$/, '');
            const parent = getTokenDef(parentKey, customStatuses);
            const statusName = token.displayName.replace(/ Count$/, '');
            const statusColor = parent ? getCategoryColor(parent) : getCategoryColor(token);
            return (<span key={key} className={styles.token}>
          {token.iconPath && (<img className={styles.tokenIcon} src={token.iconPath} alt={token.displayName}/>)}
          <span style={{ color: statusColor }}>{statusName}</span>
          <span className={styles.tokenLabel}> Count</span>
        </span>);
        }
        const color = instanceColor || getCategoryColor(token);
        return (<span key={key} className={styles.token} style={{ color }}>
        {token.iconPath && (<img className={styles.tokenIcon} src={token.iconPath} alt={token.displayName}/>)}
        <span className={styles.tokenLabel}>{token.displayName}</span>
      </span>);
    }
    if (element.type === 'wikilink') {
        const linkEl = element as {
            slug?: string;
            display?: string;
        };
        if (linkEl.slug) {
            return <WikilinkNode key={key} slug={linkEl.slug} display={linkEl.display}/>;
        }
    }
    if (element.type === 'keyword') {
        const kwEl = element as {
            keywordText?: string;
            color?: string;
        };
        if (kwEl.keywordText) {
            return (<span key={key} className={styles.keyword} style={{ color: kwEl.color }}>
          [{kwEl.keywordText}]
        </span>);
        }
    }
    if (element.type === 'paragraph') {
        return (<p key={key} className={styles.paragraph}>
        {element.children?.map((child, i) => renderNode(child, i, customStatuses))}
      </p>);
    }
    return (<span key={key}>
      {element.children?.map((child, i) => renderNode(child, i, customStatuses))}
    </span>);
}
function WikilinkNode({ slug, display }: {
    slug: string;
    display?: string;
}) {
    const existing = useContext(ExistingSlugsContext);
    const isRed = existing !== null && !existing.has(slug);
    return (<Link to={`/wiki/page/${slug}`} className={isRed ? `${styles.wikilink} ${styles.wikilinkRed}` : styles.wikilink} title={isRed ? `"${display || slug}" does not exist yet` : undefined}>
      {display || slug}
    </Link>);
}
export function CardRichText({ content }: CardRichTextProps) {
    const customStatuses = useCustomStatusStore((s) => s.statuses);
    return (<div className={styles.richText}>
      {content.map((node, i) => renderNode(node as SlateNode, i, customStatuses))}
    </div>);
}
export function RichOrPlainText({ content }: {
    content: string | Descendant[];
}) {
    const customStatuses = useCustomStatusStore((s) => s.statuses);
    if (isRichContent(content)) {
        return (<span>
        {content.map((node, i) => renderNode(node as SlateNode, i, customStatuses))}
      </span>);
    }
    return <>{renderTextWithKeywords(String(content ?? ''), 0)}</>;
}
