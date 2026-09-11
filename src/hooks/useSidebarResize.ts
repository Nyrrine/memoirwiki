import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
interface SidebarResizeOptions {
    min: number;
    max: number;
    initial: number;
    storageKey: string;
}
function loadWidth(storageKey: string, min: number, max: number, fallback: number): number {
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const w = Number(saved);
            if (w >= min && w <= max)
                return w;
        }
    }
    catch { }
    return fallback;
}
export function useSidebarResize({ min, max, initial, storageKey }: SidebarResizeOptions) {
    const [sidebarWidth, setSidebarWidth] = useState(() => loadWidth(storageKey, min, max, initial));
    const [isResizing, setIsResizing] = useState(false);
    const handleResizeStart = useCallback((e: ReactMouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = sidebarWidth;
        let latestWidth = startWidth;
        const onMouseMove = (ev: MouseEvent) => {
            latestWidth = Math.min(max, Math.max(min, startWidth + ev.clientX - startX));
            setSidebarWidth(latestWidth);
        };
        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            try {
                localStorage.setItem(storageKey, String(latestWidth));
            }
            catch { }
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [sidebarWidth, min, max, storageKey]);
    return { sidebarWidth, isResizing, handleResizeStart };
}
