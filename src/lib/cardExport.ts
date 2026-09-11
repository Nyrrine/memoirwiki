import { toPng } from 'html-to-image';
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { CardRenderer } from '../components/card/CardRenderer';
import { CardSkillPanel } from '../components/card/CardSkillPanel';
import { CardPassivePanel } from '../components/card/CardPassivePanel';
import type { Passive, ProjectData, Skill } from '../types/project';
import type { MeasuredItem } from './cardPagination';
import { computePages, sliceProjectData } from './cardPagination';
type ExportContainer = HTMLDivElement & {
    __reactRoot?: Root;
};
export async function exportCardAsPng(element: HTMLElement, filename: string): Promise<void> {
    const dataUrl = await toPng(element, {
        width: 1280,
        height: 720,
        pixelRatio: 2,
        cacheBust: true,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
}
const PAGE_BUDGET = 672;
function waitForPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}
async function renderOffScreen(element: React.ReactElement, width: number, height?: number): Promise<HTMLDivElement> {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${width}px`;
    if (height) {
        container.style.height = `${height}px`;
        container.style.overflow = 'hidden';
    }
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
        root.render(element);
    });
    (container as ExportContainer).__reactRoot = root;
    await document.fonts.ready;
    await waitForPaint();
    return container;
}
function cleanupContainer(container: HTMLDivElement) {
    const root = (container as ExportContainer).__reactRoot;
    if (root)
        root.unmount();
    container.remove();
}
const SECTIONS = [
    { key: 'skills', label: 'SKILLS', dataKey: 'skills' as const, itemType: 'skill' as const, isSkill: true },
    { key: 'defense', label: 'DEFENSE', dataKey: 'defenseSkills' as const, itemType: 'defense' as const, isSkill: true },
    { key: 'combatPassives', label: 'COMBAT PASSIVES', dataKey: 'combatPassives' as const, itemType: 'combatPassive' as const, isSkill: false },
    { key: 'supportPassives', label: 'SUPPORT PASSIVES', dataKey: 'supportPassives' as const, itemType: 'supportPassive' as const, isSkill: false },
    { key: 'customEffects', label: 'CUSTOM', dataKey: 'customEffects' as const, itemType: 'customEffect' as const, isSkill: false },
] as const;
async function measureItems(data: ProjectData): Promise<MeasuredItem[]> {
    const children: React.ReactElement[] = [];
    for (const section of SECTIONS) {
        const items = data[section.dataKey];
        if (items.length === 0)
            continue;
        children.push(React.createElement('div', {
            key: `header-${section.key}`,
            'data-export-item': `header-${section.key}`,
            'data-export-type': 'section-header',
            'data-section-key': section.key,
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '6px',
            },
        }, React.createElement('span', {
            style: {
                fontFamily: "var(--font-display)",
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-gold)',
                textTransform: 'uppercase' as const,
                letterSpacing: '3px',
                whiteSpace: 'nowrap' as const,
            },
        }, section.label), React.createElement('div', {
            style: { flex: 1, height: '1px', background: 'var(--card-border-gold-dim)' },
        })));
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemKey = `${section.itemType}-${i}`;
            if (section.isSkill) {
                children.push(React.createElement('div', {
                    key: itemKey,
                    'data-export-item': itemKey,
                    'data-export-type': section.itemType,
                    'data-original-index': i,
                    'data-section-key': section.key,
                }, React.createElement(CardSkillPanel, { skill: item as Skill, index: i })));
            }
            else {
                const passiveType = section.key === 'combatPassives' ? 'combat'
                    : section.key === 'supportPassives' ? 'support' : 'custom';
                children.push(React.createElement('div', {
                    key: itemKey,
                    'data-export-item': itemKey,
                    'data-export-type': section.itemType,
                    'data-original-index': i,
                    'data-section-key': section.key,
                }, React.createElement(CardPassivePanel, { passive: item as Passive, type: passiveType, index: i })));
            }
        }
        children.push(React.createElement('div', {
            key: `spacer-${section.key}`,
            style: { height: '10px' },
            'data-spacer': section.key,
        }));
    }
    const wrapper = React.createElement('div', {
        style: {
            width: '829px',
            padding: '0 16px',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            background: 'var(--card-bg)',
        },
    }, ...children);
    const container = await renderOffScreen(wrapper, 829);
    const measured: MeasuredItem[] = [];
    const elements = container.querySelectorAll<HTMLElement>('[data-export-item]');
    for (const el of elements) {
        const exportType = el.dataset.exportType;
        const sectionKey = el.dataset.sectionKey || '';
        if (exportType === 'section-header') {
            measured.push({
                type: 'section-header',
                sectionKey,
                height: el.offsetHeight,
                originalIndex: -1,
            });
        }
        else {
            const originalIndex = parseInt(el.dataset.originalIndex || '0', 10);
            measured.push({
                type: exportType as MeasuredItem['type'],
                sectionKey,
                height: el.offsetHeight,
                originalIndex,
            });
        }
    }
    cleanupContainer(container);
    return measured;
}
function triggerDownload(dataUrl: string, filename: string) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
export async function exportMultiPagePngs(data: ProjectData, onProgress?: (current: number, total: number) => void): Promise<void> {
    const items = await measureItems(data);
    const pages = computePages(items, PAGE_BUDGET);
    const totalPages = pages.length;
    const baseName = data.characterName || 'identity';
    if (totalPages === 1) {
        onProgress?.(1, 1);
        const container = await renderOffScreen(React.createElement(CardRenderer, { data, pageIndex: 0, totalPages: 1, leftTab: 'info' }), 1280, 720);
        const dataUrl = await toPng(container.firstElementChild as HTMLElement, {
            width: 1280,
            height: 720,
            pixelRatio: 2,
            cacheBust: true,
        });
        cleanupContainer(container);
        triggerDownload(dataUrl, `${baseName}_card.png`);
        return;
    }
    const captured: {
        dataUrl: string;
        filename: string;
    }[] = [];
    for (let i = 0; i < totalPages; i++) {
        onProgress?.(i + 1, totalPages);
        const slice = pages[i];
        const slicedData = sliceProjectData(data, slice);
        const container = await renderOffScreen(React.createElement(CardRenderer, {
            data: slicedData,
            pageIndex: i,
            totalPages,
            leftTab: slice.leftTab,
        }), 1280, 720);
        const dataUrl = await toPng(container.firstElementChild as HTMLElement, {
            width: 1280,
            height: 720,
            pixelRatio: 2,
            cacheBust: true,
        });
        cleanupContainer(container);
        captured.push({
            dataUrl,
            filename: `${baseName}_card_p${i + 1}.png`,
        });
    }
    for (let i = 0; i < captured.length; i++) {
        triggerDownload(captured[i].dataUrl, captured[i].filename);
        if (i < captured.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
        }
    }
}
export async function exportSingleImagePng(data: ProjectData, onProgress?: (current: number, total: number) => void): Promise<void> {
    onProgress?.(1, 1);
    const baseName = data.characterName || 'identity';
    const container = await renderOffScreen(React.createElement(CardRenderer, {
        data,
        pageIndex: 0,
        totalPages: 1,
        leftTab: 'info',
        layout: 'single',
    }), 1280);
    const cardEl = container.firstElementChild as HTMLElement;
    const actualHeight = cardEl.offsetHeight;
    const dataUrl = await toPng(cardEl, {
        width: 1280,
        height: actualHeight,
        pixelRatio: 2,
        cacheBust: true,
    });
    cleanupContainer(container);
    triggerDownload(dataUrl, `${baseName}_card_full.png`);
}
