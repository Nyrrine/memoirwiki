import { useState, useRef, useEffect, useCallback } from 'react';
import { searchTokensWithCustom, TOKEN_REGISTRY, getCategoryColor, type TokenDef } from '../../lib/tokens';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import styles from './TokenAutocomplete.module.css';
interface TokenAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    multiline?: boolean;
}
export function TokenAutocomplete({ value, onChange, placeholder, className, multiline = false, }: TokenAutocompleteProps) {
    const customStatuses = useCustomStatusStore((s) => s.statuses);
    const [showPopup, setShowPopup] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TokenDef[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [colonStart, setColonStart] = useState(-1);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const updateQuery = useCallback((text: string, cursorPos: number) => {
        let colonIdx = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === ':') {
                const between = text.substring(i + 1, cursorPos);
                if (!between.includes(':') && !between.includes(' ') && !between.includes('\n')) {
                    colonIdx = i;
                }
                break;
            }
            if (text[i] === ' ' || text[i] === '\n')
                break;
        }
        if (colonIdx >= 0) {
            const q = text.substring(colonIdx + 1, cursorPos);
            if (q.length >= 1) {
                const matches = searchTokensWithCustom(q, customStatuses).slice(0, 8);
                setQuery(q);
                setResults(matches);
                setShowPopup(matches.length > 0);
                setColonStart(colonIdx);
                setSelectedIndex(0);
                return;
            }
        }
        setShowPopup(false);
        setQuery('');
        setResults([]);
        setColonStart(-1);
    }, [customStatuses]);
    const insertToken = useCallback((token: TokenDef) => {
        if (colonStart < 0)
            return;
        const el = inputRef.current;
        const cursorPos = el?.selectionStart ?? value.length;
        const before = value.substring(0, colonStart);
        const after = value.substring(cursorPos);
        const newValue = `${before}:${token.key}:${after}`;
        onChange(newValue);
        setShowPopup(false);
        const newCursor = colonStart + token.key.length + 2;
        requestAnimationFrame(() => {
            if (el) {
                el.selectionStart = newCursor;
                el.selectionEnd = newCursor;
                el.focus();
            }
        });
    }, [colonStart, value, onChange]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        updateQuery(newValue, e.target.selectionStart ?? newValue.length);
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showPopup || results.length === 0)
            return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % results.length);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + results.length) % results.length);
        }
        else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertToken(results[selectedIndex]);
        }
        else if (e.key === 'Escape') {
            setShowPopup(false);
        }
    };
    const handleClick = () => {
        const el = inputRef.current;
        if (el) {
            updateQuery(value, el.selectionStart ?? value.length);
        }
    };
    useEffect(() => {
        if (!popupRef.current)
            return;
        const item = popupRef.current.children[selectedIndex] as HTMLElement;
        item?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);
    const renderPreview = () => {
        if (!value.includes(':'))
            return null;
        const parts: React.ReactNode[] = [];
        const regex = /:([a-z_]+):/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(value)) !== null) {
            const token = TOKEN_REGISTRY[match[1]];
            if (!token)
                continue;
            if (match.index > lastIndex) {
                parts.push(<span key={`t-${lastIndex}`}>{value.substring(lastIndex, match.index)}</span>);
            }
            parts.push(<span key={`tok-${match.index}`} className={styles.previewToken} style={{ color: getCategoryColor(token) }}>
          {token.iconPath && (<img src={token.iconPath} alt="" width={12} height={12} className={styles.previewIcon}/>)}
          {token.displayName}
        </span>);
            lastIndex = regex.lastIndex;
        }
        if (parts.length === 0)
            return null;
        if (lastIndex < value.length) {
            parts.push(<span key={`t-${lastIndex}`}>{value.substring(lastIndex)}</span>);
        }
        return <div className={styles.preview}>{parts}</div>;
    };
    const InputTag = (multiline ? 'textarea' : 'input') as 'textarea';
    return (<div className={styles.wrapper}>
      <InputTag ref={inputRef as React.RefObject<HTMLTextAreaElement>} className={`${styles.input} ${className ?? ''}`} value={value} onChange={handleChange} onKeyDown={handleKeyDown} onClick={handleClick} placeholder={placeholder} rows={multiline ? 3 : undefined}/>
      {renderPreview()}
      {showPopup && results.length > 0 && (<div className={styles.popup} ref={popupRef}>
          <div className={styles.popupHeader}>
            <span className={styles.popupHint}>:{query}</span>
          </div>
          {results.map((token, i) => (<div key={token.key} className={`${styles.popupItem} ${i === selectedIndex ? styles.popupItemActive : ''}`} onMouseDown={(e) => {
                    e.preventDefault();
                    insertToken(token);
                }} onMouseEnter={() => setSelectedIndex(i)}>
              {token.iconPath && (<img src={token.iconPath} alt="" width={20} height={20} className={styles.popupIcon}/>)}
              <span className={styles.popupName}>{token.displayName}</span>
              <span className={styles.popupKey}>:{token.key}:</span>
            </div>))}
        </div>)}
    </div>);
}
