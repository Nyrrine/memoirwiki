import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, roleAtLeast } from '../../hooks/useAuth';
import { WikiLayout } from './WikiLayout';
import { SectionRenderer } from './sections/SectionRenderer';
import { SectionEditor } from './sections/SectionEditor';
import { SectionPalette } from './SectionPalette';
import { CardRenderer } from '../card/CardRenderer';
import { loadWikiPage, getLinkedProjects, saveIdentityDetail, } from '../../lib/wikiPersistence';
import { loadProject } from '../../lib/projectPersistence';
import { adoptPersistedUrls } from '../../lib/imageUpload';
import { useAutosave, type SaveResult } from '../../hooks/useAutosave';
import { DraftRecoveryBar } from '../ui/DraftRecoveryBar';
import { acceptDraft, discardDraft, draftKeys, getNewestDraft, pruneDrafts, type DraftRecord } from '../../lib/draftCache';
import { createDefaultSection } from '../../types/wiki';
import type { WikiPageData, WikiPageProject, WikiSection, WikiSectionType } from '../../types/wiki';
import type { ProjectData } from '../../types/project';
import styles from './WikiIdentityBuilder.module.css';
export function WikiIdentityBuilder() {
    const { pageId, identityId } = useParams<{
        pageId: string;
        identityId: string;
    }>();
    const navigate = useNavigate();
    const user = useAuth((s) => s.user);
    const [page, setPage] = useState<WikiPageData | null>(null);
    const [link, setLink] = useState<WikiPageProject | null>(null);
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [sections, setSections] = useState<WikiSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [pendingDraft, setPendingDraft] = useState<DraftRecord<WikiSection[]> | null>(null);
    const profile = useAuth((s) => s.profile);
    const canWrite = !!page && (roleAtLeast(profile?.role, 'moderator')
        || (page.created_by === user?.id && page.status === 'draft'));
    const userId = user?.id ?? null;
    const loadedKeyRef = useRef<string | null>(null);
    const sectionsRef = useRef<WikiSection[]>(sections);
    useEffect(() => {
        if (!pageId || !identityId || !userId)
            return;
        const loadKey = `${pageId}:${identityId}`;
        if (loadedKeyRef.current === loadKey)
            return;
        loadedKeyRef.current = loadKey;
        setPendingDraft(null);
        (async () => {
            setLoading(true);
            try {
                const loaded = await loadWikiPage(pageId);
                if (!loaded) {
                    setError('Page not found');
                    setLoading(false);
                    return;
                }
                setPage(loaded);
                const links = await getLinkedProjects(loaded.id);
                const foundLink = links.find((l) => l.id === identityId);
                if (!foundLink) {
                    setError('Identity link not found');
                    setLoading(false);
                    return;
                }
                setLink(foundLink);
                sectionsRef.current = foundLink.detail_sections;
                setSections(foundLink.detail_sections);
                const project = await loadProject(foundLink.project_id);
                if (project)
                    setProjectData(project.data);
                const draft = await getNewestDraft<WikiSection[]>(draftKeys.wikiIdentity(identityId));
                if (draft && Array.isArray(draft.payload))
                    setPendingDraft(draft);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
                loadedKeyRef.current = null;
            }
            finally {
                setLoading(false);
            }
        })();
    }, [pageId, identityId, userId]);
    useEffect(() => { void pruneDrafts(); }, []);
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
    const applySections = useCallback((next: WikiSection[]) => {
        sectionsRef.current = next;
        setSections(next);
        setIsDirty(true);
    }, []);
    const handleSave = useCallback(async (): Promise<SaveResult> => {
        if (!link || !user)
            return { ok: false, stillDirty: isDirty };
        setSaving(true);
        setSaveError(null);
        const submitted = sectionsRef.current;
        try {
            const persisted = await saveIdentityDetail(link.id, submitted);
            const current = sectionsRef.current;
            const movedDuringSave = current !== submitted;
            if (!movedDuringSave) {
                sectionsRef.current = persisted;
                setSections(persisted);
                setIsDirty(false);
            }
            else {
                const merged = JSON.parse(JSON.stringify(current)) as WikiSection[];
                adoptPersistedUrls(merged, persisted);
                sectionsRef.current = merged;
                setSections(merged);
            }
            return { ok: true, stillDirty: movedDuringSave };
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed');
            return { ok: false, stillDirty: true };
        }
        finally {
            setSaving(false);
        }
    }, [link, user, isDirty]);
    const autosave = useAutosave({
        key: identityId ? draftKeys.wikiIdentity(identityId) : null,
        data: sections,
        isDirty,
        save: handleSave,
        remote: canWrite,
        holdRecovery: pendingDraft !== null,
    });
    const handleRestoreDraft = useCallback(async () => {
        if (!pendingDraft?.payload)
            return;
        applySections(pendingDraft.payload);
        await acceptDraft(pendingDraft.key);
        setPendingDraft(null);
    }, [pendingDraft, applySections]);
    const handleDiscardDraft = useCallback(async () => {
        if (pendingDraft)
            await discardDraft(pendingDraft.key);
        setPendingDraft(null);
    }, [pendingDraft]);
    const addSection = (type: WikiSectionType) => {
        applySections([...sectionsRef.current, createDefaultSection(type)]);
    };
    const updateSection = (id: string, patch: Partial<WikiSection>) => {
        applySections(sectionsRef.current.map((s) => s.id === id ? { ...s, ...patch } as WikiSection : s));
    };
    const removeSection = (id: string) => {
        applySections(sectionsRef.current.filter((s) => s.id !== id));
    };
    const reorderSection = (from: number, to: number) => {
        const next = [...sectionsRef.current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        applySections(next);
    };
    if (loading) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.muted}>Loading...</p></div>
      </WikiLayout>);
    }
    if (error || !page || !link) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.error}>{error || 'Not found'}</p></div>
      </WikiLayout>);
    }
    return (<WikiLayout breadcrumbs={[
            { label: 'Edit', to: `/wiki/edit/${page.id}` },
            { label: page.title, to: `/wiki/edit/${page.id}` },
            { label: projectData?.identityName || 'Identity Detail' },
        ]}>
      <div className={styles.builder}>
        
        <div className={styles.editorPanel}>
          <div className={styles.toolbar}>
            <button type="button" className={styles.saveBtn} onClick={() => { void autosave.saveNow(); }} disabled={saving || !isDirty || !canWrite}>
              {saving ? 'Saving...' : isDirty ? 'Save*' : 'Saved'}
            </button>
            <button type="button" className={styles.backBtn} onClick={() => {
            if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?'))
                return;
            navigate(`/wiki/edit/${page.id}`);
        }}>
              Back to Page
            </button>
          </div>

          {pendingDraft && (<DraftRecoveryBar savedAt={pendingDraft.savedAt} label="identity" droppedImages={pendingDraft.droppedImages} onRestore={() => { void handleRestoreDraft(); }} onDiscard={() => { void handleDiscardDraft(); }}/>)}
          {!canWrite && (<p className={styles.saveError}>
              This belongs to a page you cannot edit directly, so these details
              are read-only. Ask a maintainer, or work on it while the page is
              still your draft.
            </p>)}
          {saveError && <p className={styles.saveError}>{saveError}</p>}
          {autosave.status === 'local-only' && (<p className={styles.saveError}>
              These sections are too large to save automatically - use Save when you are done.
            </p>)}
          {!autosave.localOk && (<p className={styles.saveError}>
              This browser will not store a local backup, so unsaved work is not
              protected. Save often.
            </p>)}

          <h3 className={styles.sectionTitle}>
            Detail Sections for: {projectData?.identityName || 'Identity'}
          </h3>
          <p className={styles.hint}>
            Add backstory, lore, design notes, or any other content for this identity.
          </p>

          {sections.map((section, index) => (<SectionEditor key={section.id} section={section} index={index} totalSections={sections.length} collapsed={collapsedSections.has(section.id)} onToggleCollapse={() => setCollapsedSections((prev) => {
                const next = new Set(prev);
                if (next.has(section.id))
                    next.delete(section.id);
                else
                    next.add(section.id);
                return next;
            })} onUpdate={updateSection} onRemove={removeSection} onMoveUp={() => reorderSection(index, index - 1)} onMoveDown={() => reorderSection(index, index + 1)} onDragStart={(i) => setDragIndex(i)} onDragOver={(e, i) => { e.preventDefault(); setDragOverIndex(i); }} onDrop={(e, i) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i)
            reorderSection(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }} isDragOver={dragOverIndex === index} isDragging={dragIndex === index}/>))}

          <SectionPalette onAdd={addSection}/>
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <span className={styles.previewLabel}>Preview</span>
          </div>
          <div className={styles.previewContent}>
            
            {projectData && (<div className={styles.cardWrap}>
                <div className={styles.cardScale}>
                  <CardRenderer data={projectData}/>
                </div>
              </div>)}

            {sections.map((section) => (<SectionRenderer key={section.id} section={section}/>))}
          </div>
        </div>
      </div>
    </WikiLayout>);
}
