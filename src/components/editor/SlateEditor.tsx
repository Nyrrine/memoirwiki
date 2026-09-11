import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createEditor, Transforms, Editor, Range, Node, Text, type Descendant, type BaseEditor, type Path, type NodeEntry } from 'slate';
import { Slate, Editable, withReact, ReactEditor, type RenderElementProps, type RenderLeafProps } from 'slate-react';
import { withHistory, type HistoryEditor } from 'slate-history';
import { searchTokensWithCustom, getCategoryColor, getTokenDef, type TokenDef } from '../../lib/tokens';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import { findKeywords, searchKeywords } from '../../lib/keywords';
import { searchPagesByTitle } from '../../lib/wikiPersistence';
import styles from './SlateEditor.module.css';
interface TokenElement {
    type: 'token';
    tokenKey: string;
    color?: string;
    children: [
        {
            text: '';
        }
    ];
}
interface KeywordElement {
    type: 'keyword';
    keywordText: string;
    color: string;
    children: [
        {
            text: '';
        }
    ];
}
interface ParagraphElement {
    type: 'paragraph';
    children: Descendant[];
}
interface WikilinkElement {
    type: 'wikilink';
    slug: string;
    display: string;
    children: [
        {
            text: '';
        }
    ];
}
type CustomElement = TokenElement | ParagraphElement | KeywordElement | WikilinkElement;
interface CustomText {
    text: string;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    keywordColor?: string;
}
declare module 'slate' {
    interface CustomTypes {
        Editor: BaseEditor & ReactEditor & HistoryEditor;
        Element: CustomElement;
        Text: CustomText;
    }
}
function withInlineVoids(editor: Editor) {
    const { isInline, isVoid } = editor;
    editor.isInline = (element) => {
        const el = element as CustomElement;
        return el.type === 'token' || el.type === 'keyword' || el.type === 'wikilink' ? true : isInline(element);
    };
    editor.isVoid = (element) => {
        const el = element as CustomElement;
        return el.type === 'token' || el.type === 'keyword' || el.type === 'wikilink' ? true : isVoid(element);
    };
    return editor;
}
const COLOR_PRESETS = [
    '#94f140',
    '#26cfff',
    '#e63535',
    '#f28c28',
    '#f5c542',
    '#a52040',
    '#4285f4',
    '#3dba5c',
    '#8b45d6',
    '#e8c832',
    '#c83232',
    '#e85d26',
    '#d4a843',
    '#9b2d6e',
    '#2a5fa8',
    '#e8e4dc',
];
const DEFAULT_KEYWORD_COLOR = '#94f140';
function slugifyLink(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}
interface SlateEditorProps {
    value: Descendant[];
    onChange: (value: Descendant[]) => void;
    placeholder?: string;
    compact?: boolean;
}
export function SlateEditor({ value, onChange, placeholder, compact }: SlateEditorProps) {
    const editor = useMemo(() => withInlineVoids(withHistory(withReact(createEditor()))), []);
    const customStatuses = useCustomStatusStore((s) => s.statuses);
    const [target, setTarget] = useState<Range | null>(null);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<TokenDef[]>([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const popupRef = useRef<HTMLDivElement>(null);
    const [bracketTarget, setBracketTarget] = useState<Range | null>(null);
    const [bracketSearch, setBracketSearch] = useState('');
    const [bracketResults, setBracketResults] = useState<{
        label: string;
        color: string;
    }[]>([]);
    const [bracketSelectedIdx, setBracketSelectedIdx] = useState(0);
    const bracketPopupRef = useRef<HTMLDivElement>(null);
    const [linkTarget, setLinkTarget] = useState<Range | null>(null);
    const [linkSearch, setLinkSearch] = useState('');
    const [linkResults, setLinkResults] = useState<{
        slug: string;
        title: string;
    }[]>([]);
    const [linkSelectedIdx, setLinkSelectedIdx] = useState(0);
    const linkPopupRef = useRef<HTMLDivElement>(null);
    const [colorPickerPath, setColorPickerPath] = useState<Path | null>(null);
    const [colorPickerPos, setColorPickerPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [customHex, setCustomHex] = useState('');
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const openColorPicker = useCallback((path: Path, el: HTMLElement) => {
        const wrapper = wrapperRef.current;
        if (!wrapper)
            return;
        const wrapperRect = wrapper.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setColorPickerPath(path);
        setColorPickerPos({
            top: elRect.bottom - wrapperRect.top + 4,
            left: Math.max(0, elRect.left - wrapperRect.left),
        });
        const node = Node.get(editor, path) as CustomElement;
        if (node.type === 'token') {
            const tokenNode = node as TokenElement;
            const token = getTokenDef(tokenNode.tokenKey, customStatuses);
            setCustomHex(tokenNode.color || (token ? getCategoryColor(token) : ''));
        }
        else if (node.type === 'keyword') {
            const kwNode = node as KeywordElement;
            setCustomHex(kwNode.color || DEFAULT_KEYWORD_COLOR);
        }
    }, [editor, customStatuses]);
    const closeColorPicker = useCallback(() => {
        setColorPickerPath(null);
        setColorPickerPos(null);
    }, []);
    const applyColor = useCallback((color: string | undefined) => {
        if (!colorPickerPath)
            return;
        Transforms.setNodes(editor, { color } as Partial<TokenElement>, { at: colorPickerPath });
        closeColorPicker();
    }, [editor, colorPickerPath, closeColorPicker]);
    useEffect(() => {
        if (!colorPickerPath)
            return;
        const handleClick = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as HTMLElement)) {
                closeColorPicker();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [colorPickerPath, closeColorPicker]);
    const renderElement = useCallback((props: RenderElementProps) => {
        const { attributes, children, element } = props;
        const el = element as CustomElement;
        if (el.type === 'token') {
            const tokenEl = el as TokenElement;
            const token = getTokenDef(tokenEl.tokenKey, customStatuses);
            if (!token) {
                return <span {...attributes} className={styles.unknownToken}>[{tokenEl.tokenKey}]{children}</span>;
            }
            const displayColor = tokenEl.color || getCategoryColor(token);
            return (<span {...attributes} contentEditable={false} className={styles.tokenInline} style={{ color: displayColor }} onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const path = ReactEditor.findPath(editor, element);
                    openColorPicker(path, e.currentTarget as HTMLElement);
                }}>
          {token.iconPath && (<img src={token.iconPath} alt="" className={styles.tokenIcon}/>)}
          <span className={styles.tokenLabel}>{token.displayName}</span>
          {children}
        </span>);
        }
        if (el.type === 'wikilink') {
            const linkEl = el as WikilinkElement;
            return (<span {...attributes} contentEditable={false} className={styles.wikilinkInline}>
          {linkEl.display || linkEl.slug}
          {children}
        </span>);
        }
        if (el.type === 'keyword') {
            const kwEl = el as KeywordElement;
            return (<span {...attributes} contentEditable={false} className={styles.keywordInline} style={{ color: kwEl.color }} onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const path = ReactEditor.findPath(editor, element);
                    openColorPicker(path, e.currentTarget as HTMLElement);
                }}>
          [{kwEl.keywordText}]
          {children}
        </span>);
        }
        return <p {...attributes} className={styles.paragraph}>{children}</p>;
    }, [editor, openColorPicker, customStatuses]);
    const decorate = useCallback(([node, path]: NodeEntry) => {
        const ranges: (Range & {
            keywordColor?: string;
            color?: string;
            colorSyntax?: boolean;
        })[] = [];
        if (!Text.isText(node))
            return ranges;
        const { text } = node;
        const kwMatches = findKeywords(text);
        for (const m of kwMatches) {
            ranges.push({
                anchor: { path, offset: m.start },
                focus: { path, offset: m.end },
                keywordColor: m.color,
            });
        }
        const colorRegex = /\{(#[0-9a-fA-F]{3,6}):([^}]+)\}/g;
        let match;
        while ((match = colorRegex.exec(text)) !== null) {
            const fullStart = match.index;
            const fullEnd = fullStart + match[0].length;
            const hexColor = match[1];
            const innerStart = fullStart + 1 + hexColor.length + 1;
            const innerEnd = fullEnd - 1;
            ranges.push({
                anchor: { path, offset: fullStart },
                focus: { path, offset: innerStart },
                colorSyntax: true,
            });
            ranges.push({
                anchor: { path, offset: innerStart },
                focus: { path, offset: innerEnd },
                color: hexColor,
            });
            ranges.push({
                anchor: { path, offset: innerEnd },
                focus: { path, offset: fullEnd },
                colorSyntax: true,
            });
        }
        return ranges;
    }, []);
    const renderLeaf = useCallback((props: RenderLeafProps) => {
        let { children } = props;
        const leaf = props.leaf as CustomText & {
            colorSyntax?: boolean;
        };
        if (leaf.bold)
            children = <strong>{children}</strong>;
        if (leaf.italic)
            children = <em>{children}</em>;
        if (leaf.color) {
            children = <span style={{ color: leaf.color }}>{children}</span>;
        }
        if (leaf.colorSyntax) {
            children = <span style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '0.85em' }}>{children}</span>;
        }
        if (leaf.keywordColor) {
            children = <span className={styles.keyword} style={{ color: leaf.keywordColor }}>{children}</span>;
        }
        return <span {...props.attributes}>{children}</span>;
    }, []);
    const insertToken = useCallback((token: TokenDef) => {
        if (target) {
            Transforms.select(editor, target);
        }
        Transforms.delete(editor);
        const tokenNode: TokenElement = {
            type: 'token',
            tokenKey: token.key,
            children: [{ text: '' }],
        };
        Transforms.insertNodes(editor, tokenNode);
        Transforms.move(editor);
        setTarget(null);
        setSearch('');
        setResults([]);
    }, [editor, target]);
    const insertRegisteredKeyword = useCallback((label: string) => {
        if (bracketTarget) {
            Transforms.select(editor, bracketTarget);
        }
        Transforms.delete(editor);
        Transforms.insertText(editor, `[${label}]`);
        setBracketTarget(null);
        setBracketSearch('');
        setBracketResults([]);
    }, [editor, bracketTarget]);
    const insertCustomKeyword = useCallback((text: string, color: string) => {
        if (bracketTarget) {
            Transforms.select(editor, bracketTarget);
        }
        Transforms.delete(editor);
        const kwNode: KeywordElement = {
            type: 'keyword',
            keywordText: text,
            color,
            children: [{ text: '' }],
        };
        Transforms.insertNodes(editor, kwNode);
        Transforms.move(editor);
        setBracketTarget(null);
        setBracketSearch('');
        setBracketResults([]);
    }, [editor, bracketTarget]);
    const insertWikilink = useCallback((slug: string, display: string) => {
        if (linkTarget) {
            Transforms.select(editor, linkTarget);
        }
        Transforms.delete(editor);
        const linkNode: WikilinkElement = {
            type: 'wikilink',
            slug,
            display,
            children: [{ text: '' }],
        };
        Transforms.insertNodes(editor, linkNode);
        Transforms.move(editor);
        setLinkTarget(null);
        setLinkSearch('');
        setLinkResults([]);
    }, [editor, linkTarget]);
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        const lHasCustom = linkSearch.trim().length > 0;
        const lTotal = linkResults.length + (lHasCustom ? 1 : 0);
        if (linkTarget && lTotal > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setLinkSelectedIdx((i) => (i + 1) % lTotal);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setLinkSelectedIdx((i) => (i - 1 + lTotal) % lTotal);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (linkSelectedIdx < linkResults.length) {
                    const r = linkResults[linkSelectedIdx];
                    insertWikilink(r.slug, r.title);
                }
                else if (lHasCustom) {
                    const text = linkSearch.trim();
                    insertWikilink(slugifyLink(text), text);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setLinkTarget(null);
                return;
            }
        }
        if (target && results.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => (i + 1) % results.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => (i - 1 + results.length) % results.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertToken(results[selectedIdx]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setTarget(null);
                return;
            }
        }
        const bHasCustom = bracketSearch.trim().length > 0;
        const bTotal = bracketResults.length + (bHasCustom ? 1 : 0);
        if (bracketTarget && bTotal > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setBracketSelectedIdx((i) => (i + 1) % bTotal);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setBracketSelectedIdx((i) => (i - 1 + bTotal) % bTotal);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (bracketSelectedIdx < bracketResults.length) {
                    insertRegisteredKeyword(bracketResults[bracketSelectedIdx].label);
                }
                else if (bHasCustom) {
                    insertCustomKeyword(bracketSearch.trim(), DEFAULT_KEYWORD_COLOR);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setBracketTarget(null);
                return;
            }
        }
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            const marks = Editor.marks(editor);
            if (marks?.bold) {
                Editor.removeMark(editor, 'bold');
            }
            else {
                Editor.addMark(editor, 'bold', true);
            }
            return;
        }
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            const marks = Editor.marks(editor);
            if (marks?.italic) {
                Editor.removeMark(editor, 'italic');
            }
            else {
                Editor.addMark(editor, 'italic', true);
            }
            return;
        }
    }, [editor, target, results, selectedIdx, insertToken, bracketTarget, bracketResults, bracketSearch, bracketSelectedIdx, insertRegisteredKeyword, insertCustomKeyword, linkTarget, linkResults, linkSearch, linkSelectedIdx, insertWikilink]);
    const handleChange = useCallback((newValue: Descendant[]) => {
        onChange(newValue);
        const { selection } = editor;
        if (!selection || !Range.isCollapsed(selection)) {
            setTarget(null);
            setBracketTarget(null);
            setLinkTarget(null);
            return;
        }
        const [start] = Range.edges(selection);
        const textBefore = Editor.string(editor, {
            anchor: Editor.start(editor, start.path),
            focus: start,
        });
        const lastColon = textBefore.lastIndexOf(':');
        const lastBracket = textBefore.lastIndexOf('[');
        const lastDouble = textBefore.lastIndexOf('[[');
        if (lastDouble >= 0 && lastDouble + 1 === lastBracket) {
            const query = textBefore.slice(lastDouble + 2);
            if (!query.includes(']')) {
                const anchor = { path: start.path, offset: lastDouble };
                setLinkTarget({ anchor, focus: start });
                setLinkSearch(query);
                setLinkSelectedIdx(0);
                searchPagesByTitle(query).then((matches) => {
                    setLinkResults(matches);
                    setLinkSelectedIdx(0);
                });
                setTarget(null);
                setSearch('');
                setResults([]);
                setBracketTarget(null);
                setBracketSearch('');
                setBracketResults([]);
                return;
            }
        }
        if (lastColon > lastBracket && lastColon >= 0) {
            const query = textBefore.slice(lastColon + 1);
            if (query.length >= 1 && !query.includes(' ') && !query.includes(':')) {
                const matches = searchTokensWithCustom(query, customStatuses).slice(0, 8);
                if (matches.length > 0) {
                    const anchor = { path: start.path, offset: lastColon };
                    setTarget({ anchor, focus: start });
                    setSearch(query);
                    setResults(matches);
                    setSelectedIdx(0);
                    setBracketTarget(null);
                    setBracketSearch('');
                    setBracketResults([]);
                    return;
                }
            }
        }
        if (lastBracket >= 0) {
            const afterBracket = textBefore.slice(lastBracket + 1);
            if (!afterBracket.includes(']')) {
                const query = afterBracket;
                const matches = searchKeywords(query).slice(0, 8);
                const anchor = { path: start.path, offset: lastBracket };
                setBracketTarget({ anchor, focus: start });
                setBracketSearch(query);
                setBracketResults(matches);
                setBracketSelectedIdx(0);
                setTarget(null);
                setSearch('');
                setResults([]);
                return;
            }
        }
        setTarget(null);
        setSearch('');
        setResults([]);
        setBracketTarget(null);
        setBracketSearch('');
        setBracketResults([]);
        setLinkTarget(null);
        setLinkSearch('');
        setLinkResults([]);
    }, [editor, onChange, customStatuses]);
    useEffect(() => {
        if (!popupRef.current)
            return;
        const item = popupRef.current.children[selectedIdx + 1] as HTMLElement;
        item?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);
    useEffect(() => {
        if (!linkPopupRef.current)
            return;
        const item = linkPopupRef.current.children[linkSelectedIdx + 1] as HTMLElement;
        item?.scrollIntoView({ block: 'nearest' });
    }, [linkSelectedIdx]);
    useEffect(() => {
        if (!bracketPopupRef.current)
            return;
        const item = bracketPopupRef.current.children[bracketSelectedIdx + 1] as HTMLElement;
        item?.scrollIntoView({ block: 'nearest' });
    }, [bracketSelectedIdx]);
    const colorPickerDefault = useMemo(() => {
        if (!colorPickerPath)
            return null;
        try {
            const node = Node.get(editor, colorPickerPath) as CustomElement;
            if (node.type === 'token') {
                return getTokenDef((node as TokenElement).tokenKey, customStatuses)?.color || '#aaaaaa';
            }
            if (node.type === 'keyword') {
                return DEFAULT_KEYWORD_COLOR;
            }
            return null;
        }
        catch {
            return null;
        }
    }, [editor, colorPickerPath, customStatuses]);
    const bracketHasCustom = bracketSearch.trim().length > 0;
    const bracketTotalItems = bracketResults.length + (bracketHasCustom ? 1 : 0);
    return (<div className={styles.editorWrapper} ref={wrapperRef}>
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <Editable className={`${styles.editable}${compact ? ` ${styles.editableCompact}` : ''}`} renderElement={renderElement} renderLeaf={renderLeaf} decorate={decorate} onKeyDown={onKeyDown} placeholder={placeholder ?? 'Type here... :token: [keyword] {#hex:colored text}'} spellCheck={false}/>
      </Slate>

      {target && results.length > 0 && (<div className={styles.popup} ref={popupRef}>
          <div className={styles.popupHeader}>
            <span className={styles.popupHint}>:{search}</span>
          </div>
          {results.map((token, i) => (<div key={token.key} className={`${styles.popupItem} ${i === selectedIdx ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    insertToken(token);
                }} onMouseEnter={() => setSelectedIdx(i)}>
              {token.iconPath && (<img src={token.iconPath} alt="" width={18} height={18} className={styles.popupIcon}/>)}
              <span className={styles.popupName}>{token.displayName}</span>
              <span className={styles.popupKey}>:{token.key}:</span>
            </div>))}
        </div>)}

      {linkTarget && (linkResults.length > 0 || linkSearch.trim().length > 0) && (<div className={styles.popup} ref={linkPopupRef}>
          <div className={styles.popupHeader}>
            <span className={styles.popupHint}>[[{linkSearch}</span>
          </div>
          {linkResults.map((pageResult, i) => (<div key={pageResult.slug} className={`${styles.popupItem} ${i === linkSelectedIdx ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    insertWikilink(pageResult.slug, pageResult.title);
                }} onMouseEnter={() => setLinkSelectedIdx(i)}>
              <span className={styles.popupName}>{pageResult.title}</span>
              <span className={styles.popupKey}>{pageResult.slug}</span>
            </div>))}
          {linkSearch.trim().length > 0 && (<div className={`${styles.popupItem} ${styles.popupItemCustom} ${linkSelectedIdx === linkResults.length ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    const text = linkSearch.trim();
                    insertWikilink(slugifyLink(text), text);
                }} onMouseEnter={() => setLinkSelectedIdx(linkResults.length)}>
              <span className={styles.popupName}>Link to "{linkSearch.trim()}"</span>
              <span className={styles.popupKey}>new page</span>
            </div>)}
        </div>)}

      {bracketTarget && bracketTotalItems > 0 && (<div className={styles.popup} ref={bracketPopupRef}>
          <div className={styles.popupHeader}>
            <span className={styles.popupHint}>[{bracketSearch}</span>
          </div>
          {bracketResults.map((kw, i) => (<div key={kw.label} className={`${styles.popupItem} ${i === bracketSelectedIdx ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    insertRegisteredKeyword(kw.label);
                }} onMouseEnter={() => setBracketSelectedIdx(i)}>
              <span className={styles.popupColorDot} style={{ backgroundColor: kw.color }}/>
              <span className={styles.popupName}>[{kw.label}]</span>
            </div>))}
          {bracketHasCustom && (<div className={`${styles.popupItem} ${styles.popupItemCustom} ${bracketSelectedIdx === bracketResults.length ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    insertCustomKeyword(bracketSearch.trim(), DEFAULT_KEYWORD_COLOR);
                }} onMouseEnter={() => setBracketSelectedIdx(bracketResults.length)}>
              <span className={styles.popupColorDot} style={{ backgroundColor: DEFAULT_KEYWORD_COLOR }}/>
              <span className={styles.popupName}>Create [{bracketSearch.trim()}]</span>
              <span className={styles.popupKey}>custom</span>
            </div>)}
        </div>)}

      {colorPickerPath && colorPickerPos && (<div ref={colorPickerRef} className={styles.colorPicker} style={{ top: colorPickerPos.top, left: colorPickerPos.left }}>
          <div className={styles.colorPickerLabel}>Color</div>
          <div className={styles.colorPresets}>
            {COLOR_PRESETS.map((c) => (<button key={c} className={styles.colorSwatch} style={{ backgroundColor: c }} title={c} onMouseDown={(e) => {
                    e.preventDefault();
                    applyColor(c);
                }}/>))}
          </div>
          <div className={styles.colorCustomRow}>
            <input type="text" className={styles.colorHexInput} value={customHex} onChange={(e) => setCustomHex(e.target.value)} placeholder="#hex" maxLength={7} onKeyDown={(e) => {
                if (e.key === 'Enter' && /^#[0-9a-fA-F]{3,6}$/.test(customHex)) {
                    e.preventDefault();
                    applyColor(customHex);
                }
            }}/>
            <button className={styles.colorApplyBtn} onMouseDown={(e) => {
                e.preventDefault();
                if (/^#[0-9a-fA-F]{3,6}$/.test(customHex)) {
                    applyColor(customHex);
                }
            }}>
              Apply
            </button>
          </div>
          <button className={styles.colorResetBtn} onMouseDown={(e) => {
                e.preventDefault();
                applyColor(undefined);
            }}>
            Reset to Default{colorPickerDefault && (<span className={styles.colorResetSwatch} style={{ backgroundColor: colorPickerDefault }}/>)}
          </button>
        </div>)}
    </div>);
}
