import { useState, useRef, useEffect } from 'react';
import { exportMultiPagePngs, exportSingleImagePng } from '../../lib/cardExport';
import type { ProjectData } from '../../types/project';
import styles from './ExportDropdown.module.css';
interface ExportDropdownProps {
    data: ProjectData;
    disabled?: boolean;
    buttonClassName?: string;
}
export function ExportDropdown({ data, disabled, buttonClassName }: ExportDropdownProps) {
    const [open, setOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<{
        current: number;
        total: number;
    } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const handleClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);
    const handleExport = async (mode: 'multi' | 'single') => {
        setOpen(false);
        setExporting(true);
        setExportProgress(null);
        try {
            if (mode === 'multi') {
                await exportMultiPagePngs(data, (current, total) => {
                    setExportProgress({ current, total });
                });
            }
            else {
                await exportSingleImagePng(data, (current, total) => {
                    setExportProgress({ current, total });
                });
            }
        }
        catch {
        }
        finally {
            setExporting(false);
            setExportProgress(null);
        }
    };
    const label = exporting
        ? exportProgress
            ? `${exportProgress.current}/${exportProgress.total}...`
            : '...'
        : 'Download';
    return (<div className={styles.wrapper} ref={wrapperRef}>
      <button className={buttonClassName} onClick={() => setOpen((v) => !v)} disabled={disabled || exporting} type="button">
        {label}
      </button>
      {open && (<div className={styles.popover}>
          <button className={styles.option} onClick={() => handleExport('multi')} type="button">
            Multiple Images
          </button>
          <button className={styles.option} onClick={() => handleExport('single')} type="button">
            Single Image
          </button>
        </div>)}
    </div>);
}
