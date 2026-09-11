import { lazy, Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../../hooks/useProjectStore';
import { useAuth } from '../../hooks/useAuth';
import { CardRenderer } from '../card/CardRenderer';
import { EntryList, type EntryRef } from '../editor/EntryList';
import { SkillEditor } from '../editor/SkillEditor';
import { PassiveEditor } from '../editor/PassiveEditor';
const WikiBrowser = lazy(() => import('../wiki/WikiBrowser').then((m) => ({ default: m.WikiBrowser })));
const SkillArtPicker = lazy(() => import('../editor/SkillArtPicker').then((m) => ({ default: m.SkillArtPicker })));
import { DAMAGE_LABELS, RESISTANCE_LABELS } from '../../lib/sinHelpers';
import { SINNER_ICONS } from '../../lib/sinnerIcons';
import { MIRROR_WORLD_ICONS } from '../../lib/mirrorWorldIcons';
import { MENTAL_ICONS } from '../../lib/mentalIconRegistry';
import { BACKGROUNDS } from '../../lib/backgroundRegistry';
import { STORY_ICONS, DEFAULT_AVATAR } from '../../lib/storyIcons';
import { saveProject } from '../../lib/projectPersistence';
import { useAutosave, type SaveResult } from '../../hooks/useAutosave';
import type { ProjectData } from '../../types/project';
import { DraftRecoveryBar } from '../ui/DraftRecoveryBar';
import { acceptDraft, deleteDraft, discardDraft, draftKeys, getNewestDraft, pruneDrafts, type DraftRecord, } from '../../lib/draftCache';
import { useSidebarResize } from '../../hooks/useSidebarResize';
import { listRecentChanges } from '../../lib/wikiPersistence';
import type { WikiPageMeta } from '../../types/wiki';
import { CustomStatusManager } from '../wiki/CustomStatusManager';
import { WhatsNewModal } from '../ui/WhatsNewModal';
import { CURRENT_RELEASE, shouldShowWhatsNew } from '../../lib/whatsNew';
import { SavesTab } from '../saves/SavesTab';
import { ProjectDetailModal } from '../saves/ProjectDetailModal';
import type { DamageType, ResistanceLevel, UptieLevel } from '../../types/project';
import styles from './EditorShell.module.css';
import { traitLabel, traitStruck } from '../../types/project';
const CARD_W = 1280;
const CARD_H = 720;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIDEBAR_MIN = 320;
const SIDEBAR_MAX = 540;
const SIDEBAR_DEFAULT = 400;
const SIDEBAR_STORAGE_KEY = 'limbus-oc-sidebar-width';
const ALL_DAMAGE_TYPES: DamageType[] = ['slash', 'pierce', 'blunt'];
const ALL_RESISTANCE_LEVELS: ResistanceLevel[] = ['fatal', 'weak', 'normal', 'endured', 'ineffective'];
type ToolMode = 'maker' | 'saves' | 'wiki' | 'story';
const TOOL_TABS: {
    mode: ToolMode;
    label: string;
    wip?: boolean;
}[] = [
    { mode: 'maker', label: 'Maker' },
    { mode: 'saves', label: 'Saves' },
    { mode: 'wiki', label: 'Wiki' },
    { mode: 'story', label: 'Story', wip: true },
];
const WIP_TITLES: Record<string, string> = {
    wiki: 'Character Wiki',
    story: 'Story Maker',
};
export function EditorShell() {
    const project = useProjectStore((s) => s.project);
    const isDirty = useProjectStore((s) => s.isDirty);
    const currentProjectId = useProjectStore((s) => s.currentProjectId);
    const markClean = useProjectStore((s) => s.markClean);
    const loadProjectData = useProjectStore((s) => s.loadProject);
    const user = useAuth((s) => s.user);
    const profile = useAuth((s) => s.profile);
    const signOut = useAuth((s) => s.signOut);
    const setAvatarIcon = useAuth((s) => s.setAvatarIcon);
    const setReadReceipts = useAuth((s) => s.setReadReceipts);
    const resetProject = useProjectStore((s) => s.resetProject);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
    const [receiptError, setReceiptError] = useState<string | null>(null);
    const [whatsNewOpen, setWhatsNewOpen] = useState(() => shouldShowWhatsNew());
    const setCharacterName = useProjectStore((s) => s.setCharacterName);
    const setIdentityName = useProjectStore((s) => s.setIdentityName);
    const setRarity = useProjectStore((s) => s.setRarity);
    const setSinnerIconUrl = useProjectStore((s) => s.setSinnerIconUrl);
    const setLevel = useProjectStore((s) => s.setLevel);
    const setUptieLevel = useProjectStore((s) => s.setUptieLevel);
    const setStats = useProjectStore((s) => s.setStats);
    const setResistances = useProjectStore((s) => s.setResistances);
    const setPortraitUrl = useProjectStore((s) => s.setPortraitUrl);
    const addTrait = useProjectStore((s) => s.addTrait);
    const removeTrait = useProjectStore((s) => s.removeTrait);
    const toggleTraitStruck = useProjectStore((s) => s.toggleTraitStruck);
    const setMirrorWorldIconUrl = useProjectStore((s) => s.setMirrorWorldIconUrl);
    const setMirrorWorldName = useProjectStore((s) => s.setMirrorWorldName);
    const addSkill = useProjectStore((s) => s.addSkill);
    const updateSkill = useProjectStore((s) => s.updateSkill);
    const removeSkill = useProjectStore((s) => s.removeSkill);
    const addDefenseSkill = useProjectStore((s) => s.addDefenseSkill);
    const updateDefenseSkill = useProjectStore((s) => s.updateDefenseSkill);
    const removeDefenseSkill = useProjectStore((s) => s.removeDefenseSkill);
    const addPassive = useProjectStore((s) => s.addPassive);
    const updatePassive = useProjectStore((s) => s.updatePassive);
    const removePassive = useProjectStore((s) => s.removePassive);
    const setCautionColor = useProjectStore((s) => s.setCautionColor);
    const setInfoBarBgColor = useProjectStore((s) => s.setInfoBarBgColor);
    const setRightColumnBgUrl = useProjectStore((s) => s.setRightColumnBgUrl);
    const setRightColumnBgOpacity = useProjectStore((s) => s.setRightColumnBgOpacity);
    const setSanity = useProjectStore((s) => s.setSanity);
    const addSanityFactor = useProjectStore((s) => s.addSanityFactor);
    const removeSanityFactor = useProjectStore((s) => s.removeSanityFactor);
    const updateSanityFactor = useProjectStore((s) => s.updateSanityFactor);
    const viewportRef = useRef<HTMLDivElement>(null);
    const sinnerFileRef = useRef<HTMLInputElement>(null);
    const portraitFileRef = useRef<HTMLInputElement>(null);
    const [scale, setScale] = useState(0.5);
    const { sidebarWidth, isResizing, handleResizeStart } = useSidebarResize({
        min: SIDEBAR_MIN, max: SIDEBAR_MAX, initial: SIDEBAR_DEFAULT, storageKey: SIDEBAR_STORAGE_KEY,
    });
    const [sinnerPickerOpen, setSinnerPickerOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<EntryRef | null>(null);
    const [artPickerSkillId, setArtPickerSkillId] = useState<string | null>(null);
    const [identityOpen, setIdentityOpen] = useState(true);
    const [statsOpen, setStatsOpen] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const [entriesOpen, setEntriesOpen] = useState(true);
    const [editorOpen, setEditorOpen] = useState(true);
    const [leftTab, setLeftTab] = useState<'info' | 'sanity'>('info');
    const [mirrorPickerOpen, setMirrorPickerOpen] = useState(false);
    const [traitInput, setTraitInput] = useState('');
    const [sanityOpen, setSanityOpen] = useState(true);
    const [panicPickerOpen, setPanicPickerOpen] = useState(false);
    const [incFactorInput, setIncFactorInput] = useState('');
    const [decFactorInput, setDecFactorInput] = useState('');
    const [bgPickerOpen, setBgPickerOpen] = useState(false);
    const [activeTool, setActiveToolRaw] = useState<ToolMode>(() => {
        try {
            const saved = localStorage.getItem('limbus-oc-active-tool');
            if (saved && ['maker', 'saves', 'wiki', 'story'].includes(saved))
                return saved as ToolMode;
        }
        catch { }
        return 'maker';
    });
    const setActiveTool = useCallback((mode: ToolMode) => {
        setActiveToolRaw(mode);
        try {
            localStorage.setItem('limbus-oc-active-tool', mode);
        }
        catch { }
    }, []);
    const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
    const [savesRefreshKey, setSavesRefreshKey] = useState(0);
    const [pendingDraft, setPendingDraft] = useState<DraftRecord<ProjectData> | null>(null);
    const [wikiPages, setWikiPages] = useState<WikiPageMeta[]>([]);
    const [wikiLoading, setWikiLoading] = useState(false);
    const [wikiSearch, setWikiSearch] = useState('');
    const [wikiError, setWikiError] = useState<string | null>(null);
    const loadProjectInStore = useProjectStore((s) => s.loadProject);
    const bgFileRef = useRef<HTMLInputElement>(null);
    const mirrorFileRef = useRef<HTMLInputElement>(null);
    const panicFileRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
    const computeScale = useCallback(() => {
        const el = viewportRef.current;
        if (!el)
            return;
        const pad = 32;
        const maxW = el.clientWidth - pad * 2;
        const maxH = el.clientHeight - pad * 2;
        const s = Math.min(maxW / CARD_W, maxH / CARD_H, 1);
        setScale(Math.max(s, 0.2));
    }, []);
    useEffect(() => {
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [computeScale]);
    useEffect(() => { computeScale(); }, [sidebarWidth, computeScale]);
    useEffect(() => {
        if (activeTool !== 'wiki' || !user)
            return;
        setWikiLoading(true);
        listRecentChanges(30)
            .then(setWikiPages)
            .catch((err: unknown) => {
            setWikiError(err instanceof Error ? err.message : 'Failed to load wiki pages');
        })
            .finally(() => setWikiLoading(false));
    }, [activeTool, user]);
    const confirmLeaveEditor = useCallback(() => !isDirty || window.confirm('You have unsaved changes. Leave the editor?'), [isDirty]);
    const handleSinnerFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
            setSaveError('File too large (max 10 MB)');
            setTimeout(() => setSaveError((cur) => cur === 'File too large (max 10 MB)' ? null : cur), 5000);
            e.target.value = '';
            return;
        }
        if (file)
            setSinnerIconUrl(URL.createObjectURL(file));
        e.target.value = '';
        setSinnerPickerOpen(false);
    }, [setSinnerIconUrl]);
    const handlePortraitUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
            setSaveError('File too large (max 10 MB)');
            setTimeout(() => setSaveError((cur) => cur === 'File too large (max 10 MB)' ? null : cur), 5000);
            e.target.value = '';
            return;
        }
        if (file)
            setPortraitUrl(URL.createObjectURL(file));
        e.target.value = '';
    }, [setPortraitUrl]);
    const handleMirrorUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
            setSaveError('File too large (max 10 MB)');
            setTimeout(() => setSaveError((cur) => cur === 'File too large (max 10 MB)' ? null : cur), 5000);
            e.target.value = '';
            return;
        }
        if (file) {
            setMirrorWorldIconUrl(URL.createObjectURL(file));
            setMirrorWorldName('');
        }
        e.target.value = '';
        setMirrorPickerOpen(false);
    }, [setMirrorWorldIconUrl, setMirrorWorldName]);
    const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
            setSaveError('File too large (max 10 MB)');
            setTimeout(() => setSaveError((cur) => cur === 'File too large (max 10 MB)' ? null : cur), 5000);
            e.target.value = '';
            return;
        }
        if (file)
            setRightColumnBgUrl(URL.createObjectURL(file));
        e.target.value = '';
        setBgPickerOpen(false);
    }, [setRightColumnBgUrl]);
    const handlePanicIconUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
            setSaveError('File too large (max 10 MB)');
            setTimeout(() => setSaveError((cur) => cur === 'File too large (max 10 MB)' ? null : cur), 5000);
            e.target.value = '';
            return;
        }
        if (file)
            setSanity({ panicIconUrl: URL.createObjectURL(file) });
        e.target.value = '';
        setPanicPickerOpen(false);
    }, [setSanity]);
    const handleSave = useCallback(async (): Promise<SaveResult> => {
        if (!user)
            return { ok: false, stillDirty: isDirty };
        setSaving(true);
        setSaveError(null);
        const sent = project;
        const estimatedSize = new Blob([JSON.stringify(project)]).size;
        if (estimatedSize > 1500000) {
            setSaveError('Warning: project data is very large - save may fail');
            setTimeout(() => setSaveError((cur) => cur?.startsWith('Warning') ? null : cur), 5000);
        }
        try {
            const { id, data } = await saveProject(project, user.id, currentProjectId ?? undefined);
            const movedDuringSave = useProjectStore.getState().project !== sent;
            markClean(id, data, movedDuringSave);
            setSavesRefreshKey((k) => k + 1);
            return { ok: true, stillDirty: movedDuringSave };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Save failed';
            setSaveError(msg);
            setTimeout(() => setSaveError((cur) => cur === msg ? null : cur), 5000);
            return { ok: false, stillDirty: true };
        }
        finally {
            setSaving(false);
        }
    }, [user, project, isDirty, currentProjectId, markClean]);
    const handleSaveNew = useCallback(async () => {
        if (!user)
            return;
        setSaving(true);
        setSaveError(null);
        const sent = project;
        const estimatedSize = new Blob([JSON.stringify(project)]).size;
        if (estimatedSize > 1500000) {
            setSaveError('Warning: project data is very large - save may fail');
            setTimeout(() => setSaveError((cur) => cur?.startsWith('Warning') ? null : cur), 5000);
        }
        try {
            const newId = crypto.randomUUID();
            const { id, data } = await saveProject(project, user.id, newId);
            const movedDuringSave = useProjectStore.getState().project !== sent;
            markClean(id, data, movedDuringSave);
            setSavesRefreshKey((k) => k + 1);
            const newCardKey = draftKeys.card(null);
            await deleteDraft(newCardKey);
            await deleteDraft(draftKeys.live(newCardKey));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Save failed';
            setSaveError(msg);
            setTimeout(() => setSaveError((cur) => cur === msg ? null : cur), 5000);
        }
        finally {
            setSaving(false);
        }
    }, [user, project, markClean]);
    const autosave = useAutosave({
        key: draftKeys.card(currentProjectId),
        data: project,
        isDirty,
        save: handleSave,
        remote: currentProjectId !== null,
        holdRecovery: pendingDraft !== null,
    });
    useEffect(() => { void pruneDrafts(); }, []);
    const checkedDraftKeyRef = useRef<string | null>(null);
    useEffect(() => {
        const key = draftKeys.card(currentProjectId);
        if (checkedDraftKeyRef.current === key)
            return;
        checkedDraftKeyRef.current = key;
        setPendingDraft(null);
        let cancelled = false;
        (async () => {
            const draft = await getNewestDraft<ProjectData>(key);
            if (!cancelled && draft?.payload)
                setPendingDraft(draft);
        })();
        return () => { cancelled = true; };
    }, [currentProjectId]);
    const handleRestoreDraft = useCallback(async () => {
        if (!pendingDraft?.payload)
            return;
        const ownKey = draftKeys.card(currentProjectId);
        if (pendingDraft.key !== ownKey) {
            setPendingDraft(null);
            return;
        }
        loadProjectData(pendingDraft.payload, currentProjectId);
        useProjectStore.setState({ isDirty: true });
        await acceptDraft(ownKey);
        setPendingDraft(null);
    }, [pendingDraft, currentProjectId, loadProjectData]);
    const handleDiscardDraft = useCallback(async () => {
        if (pendingDraft)
            await discardDraft(draftKeys.card(currentProjectId));
        setPendingDraft(null);
    }, [pendingDraft, currentProjectId]);
    const renderEntryEditor = () => {
        if (!selectedEntry)
            return null;
        const { type, id } = selectedEntry;
        if (type === 'skill') {
            const skill = project.skills.find((s) => s.id === id);
            if (!skill)
                return null;
            return (<SkillEditor key={id} skill={skill} index={project.skills.indexOf(skill)} onUpdate={(patch) => updateSkill(id, patch)} onBrowseArt={() => setArtPickerSkillId(id)}/>);
        }
        if (type === 'defense') {
            const def = project.defenseSkills.find((d) => d.id === id);
            if (!def)
                return null;
            return (<SkillEditor key={id} skill={def} index={project.defenseSkills.indexOf(def)} onUpdate={(patch) => updateDefenseSkill(id, patch)} onBrowseArt={() => setArtPickerSkillId(id)}/>);
        }
        if (type === 'combat' || type === 'support' || type === 'custom') {
            const arrMap = {
                combat: project.combatPassives,
                support: project.supportPassives,
                custom: project.customEffects,
            };
            const passive = arrMap[type].find((p) => p.id === id);
            if (!passive)
                return null;
            return (<PassiveEditor key={id} passive={passive} type={type} onUpdate={(patch) => updatePassive(type, id, patch)}/>);
        }
        return null;
    };
    return (<div className={styles.shell}>
      
      <aside className={styles.sidebar} style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoRow}>
            <img className={styles.logoImg} src="/ui/limbus-logo.webp" alt="Limbus Company"/>
            <div className={styles.logoText}>
              <span className={styles.logoLine}>Memoir</span>
              <span className={styles.logoLine}>ToolKit</span>
            </div>
          </div>
          <div className={styles.toolTabs}>
            {TOOL_TABS.map((tab) => (<button key={tab.mode} className={activeTool === tab.mode ? styles.toolTabActive : styles.toolTab} onClick={() => setActiveTool(tab.mode)} type="button">
                {tab.label}
                {tab.wip && <span className={styles.wipBadge}>WIP</span>}
              </button>))}
          </div>
          <div className={styles.userBar}>
            <div className={styles.avatarWrap}>
              <button className={styles.avatarBtn} onClick={() => setAvatarPickerOpen(!avatarPickerOpen)} type="button" title="Change avatar">
                <img className={styles.avatarImg} src={profile?.avatar_icon || DEFAULT_AVATAR} alt=""/>
              </button>
              {avatarPickerOpen && (<div className={styles.avatarPicker}>
                  <div className={styles.avatarOptions}>
                    {STORY_ICONS.map((si) => (<img key={si.id} className={`${styles.avatarOption} ${(profile?.avatar_icon || DEFAULT_AVATAR) === si.path ? styles.avatarOptionActive : ''}`} src={si.path} alt={si.label} title={si.label} onClick={() => { setAvatarIcon(si.path); setAvatarPickerOpen(false); }}/>))}
                  </div>
                  <label className={styles.receiptToggle}>
                    <input type="checkbox" checked={profile?.show_read_receipts ?? true} onChange={(e) => {
                const on = e.target.checked;
                setReceiptError(null);
                setReadReceipts(on).catch((err: unknown) => setReceiptError(err instanceof Error ? err.message : 'Could not change that'));
            }}/>
                    Show my reading on wiki pages
                  </label>
                  <p className={styles.receiptHint}>
                    Turning this off stops new visits being recorded and deletes
                    the ones already stored.
                  </p>
                  {receiptError && <p className={styles.receiptError}>{receiptError}</p>}
                  <button type="button" className={styles.whatsNewLink} onClick={() => { setAvatarPickerOpen(false); setWhatsNewOpen(true); }}>
                    What's New
                    <span className={styles.whatsNewVersion}>v{CURRENT_RELEASE.version}</span>
                  </button>
                </div>)}
            </div>
            <span className={styles.username}>{profile?.username ?? '...'}</span>
            <button className={styles.signOutBtn} onClick={() => {
            if (isDirty && !window.confirm('You have unsaved changes. Start a new identity?'))
                return;
            resetProject();
            setActiveTool('maker');
        }} type="button" title="New identity">
              New
            </button>
            <button className={`${styles.saveBtn} ${styles.saveBtnOverwrite} ${isDirty && currentProjectId ? styles.saveBtnDirty : ''}`} onClick={() => { void autosave.saveNow(); }} disabled={saving || !currentProjectId} type="button" title={!currentProjectId ? 'No existing save to overwrite' : isDirty ? 'Overwrite existing save' : 'All changes saved'}>
              {saving ? '...' : 'Overwrite'}
            </button>
            <button className={`${styles.saveBtn} ${styles.saveBtnNew} ${isDirty ? styles.saveBtnDirty : ''}`} onClick={() => {
            void (async () => {
                const started = await autosave.runExclusive(handleSaveNew);
                if (started === null) {
                    const msg = 'A save is already running - try again in a moment.';
                    setSaveError(msg);
                    setTimeout(() => setSaveError((cur) => cur === msg ? null : cur), 4000);
                }
            })();
        }} disabled={saving} type="button" title="Save as a new identity">
              {saving ? '...' : 'Save New'}
              {isDirty && !saving && <span className={styles.dirtyDot}/>}
            </button>
            <button className={styles.signOutBtn} onClick={signOut} type="button" title="Sign out">
              Sign Out
            </button>
          </div>
          {saveError && <div className={styles.saveError}>{saveError}</div>}
          {autosave.status === 'local-only' && (<div className={styles.saveError}>
              This card is too large to save automatically - use Overwrite or Save New when you are done.
            </div>)}
          {!autosave.localOk && (<div className={styles.saveError}>
              This browser will not store a local backup, so unsaved work is not protected.
            </div>)}
          {pendingDraft && (<DraftRecoveryBar savedAt={pendingDraft.savedAt} label="card" droppedImages={pendingDraft.droppedImages} onRestore={() => { void handleRestoreDraft(); }} onDiscard={() => { void handleDiscardDraft(); }}/>)}
        </div>

        <div className={styles.sidebarContent}>
          {activeTool === 'wiki' && (<div className={styles.wikiSidebarContent}>
              <Link to="/wiki/guide/user-guide" className={styles.wikiQuickLink}>User Guide</Link>
              <div className={styles.wikiDivider}/>
              <div className={styles.wikiListHeader}>
                <span className={styles.wikiListTitle}>Recent Wiki Pages</span>
                <Link to="/wiki" className={styles.wikiViewAll}>View All</Link>
              </div>
              {wikiError ? (<p className={styles.wikiHint}>{wikiError}</p>) : wikiLoading ? (<p className={styles.wikiHint}>Loading...</p>) : wikiPages.length === 0 ? (<p className={styles.wikiHint}>No wiki pages yet.</p>) : (<div className={styles.wikiList}>
                  {wikiPages.map((wp) => (<div key={wp.id} className={styles.wikiListItem}>
                      <Link to={`/wiki/edit/${wp.id}`} className={styles.wikiPageLink} onClick={(e) => {
                        if (isDirty && !window.confirm('You have unsaved changes. Leave to wiki?')) {
                            e.preventDefault();
                        }
                    }}>
                        {wp.title}
                      </Link>
                      <span className={`${styles.wikiStatus} ${wp.status === 'published' ? styles.wikiPublished : ''}`}/>
                    </div>))}
                </div>)}
              <Link to="/wiki" className={styles.wikiCreateBtn} onClick={(e) => {
                if (isDirty && !window.confirm('You have unsaved changes. Leave to wiki?')) {
                    e.preventDefault();
                }
            }}>
                + Create Page
              </Link>
              <div className={styles.wikiDivider}/>
              <CustomStatusManager />
            </div>)}
          {activeTool === 'story' && (<div className={styles.wipSidebar}>
              <span>This tool is not yet available.</span>
            </div>)}
          {activeTool === 'saves' && (<SavesTab onViewProject={(id) => setDetailProjectId(id)} refreshKey={savesRefreshKey}/>)}
          {activeTool === 'maker' && (<>
          
          <div className={styles.editorSection}>
            <div className={styles.sectionHeader} onClick={() => setIdentityOpen(!identityOpen)} style={{ cursor: 'pointer' }}>
              <span className={styles.sectionTitle}>IDENTITY</span>
              <span className={styles.collapseIcon}>{identityOpen ? '−' : '+'}</span>
              <div className={styles.sectionLine}/>
            </div>
            {identityOpen && (<div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Character</span>
                  <input className={styles.inputField} type="text" value={project.characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Character name"/>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Identity</span>
                  <input className={styles.inputField} type="text" value={project.identityName} onChange={(e) => setIdentityName(e.target.value)} placeholder="Identity name"/>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Level</span>
                  <input className={styles.numberInput} type="number" value={project.level} onChange={(e) => setLevel(Number(e.target.value) || 1)} min={1} max={60}/>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Rarity</span>
                    <div className={styles.rarityPicker}>
                      {([1, 2, 3] as const).map((r) => (<img key={r} className={`${styles.rarityOption} ${r === project.rarity ? styles.rarityOptionActive : ''}`} src={`/icons/rarity/rarity-${r}.png`} alt={`Rarity ${r}`} onClick={() => setRarity(r)}/>))}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Uptie</span>
                    <div className={styles.uptiePicker}>
                      {([1, 2, 3, 4] as const).map((u) => (<img key={u} className={`${styles.uptieOption} ${u === project.uptieLevel ? styles.uptieOptionActive : ''}`} src={u === 1 ? '/icons/uptie/uptie1.png' : `/icons/uptie/uptie${u}.webp`} alt={`Uptie ${u}`} title={`Uptie ${['I', 'II', 'III', 'IV'][u - 1]}`} onClick={() => setUptieLevel(u as UptieLevel)}/>))}
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Icon</span>
                  <div className={styles.sinnerIconField}>
                    {project.sinnerIconUrl && (<img className={styles.sinnerIconPreview} src={project.sinnerIconUrl} alt="Sinner icon"/>)}
                    <button className={styles.smallBtn} onClick={() => setSinnerPickerOpen(!sinnerPickerOpen)} type="button">
                      {project.sinnerIconUrl ? 'Change' : 'Select'}
                    </button>
                    {project.sinnerIconUrl && (<button className={styles.smallBtnDanger} onClick={() => setSinnerIconUrl(null)} type="button">x</button>)}
                  </div>
                </div>
                {sinnerPickerOpen && (<div className={styles.sinnerGrid}>
                    {SINNER_ICONS.map((si) => (<img key={si.id} className={`${styles.sinnerGridIcon} ${project.sinnerIconUrl === si.path ? styles.sinnerGridIconActive : ''}`} src={si.path} alt={si.label} title={si.label} onClick={() => { setSinnerIconUrl(si.path); setSinnerPickerOpen(false); }}/>))}
                    <button className={styles.sinnerUploadBtn} onClick={() => sinnerFileRef.current?.click()} type="button" title="Upload custom icon">+</button>
                    <input ref={sinnerFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSinnerFileUpload}/>
                  </div>)}

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Portrait <span className={styles.fieldHint}>498 × 280</span></span>
                  <div className={styles.sinnerIconField}>
                    {project.portraitUrl && (<img className={styles.portraitPreview} src={project.portraitUrl} alt="Portrait"/>)}
                    <button className={styles.smallBtn} onClick={() => portraitFileRef.current?.click()} type="button">
                      {project.portraitUrl ? 'Change' : 'Upload'}
                    </button>
                    {project.portraitUrl && (<button className={styles.smallBtnDanger} onClick={() => setPortraitUrl(null)} type="button">x</button>)}
                    <input ref={portraitFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortraitUpload}/>
                  </div>
                </div>
              </div>)}
          </div>

          <div className={styles.editorSection}>
            <div className={styles.sectionHeader} onClick={() => setStatsOpen(!statsOpen)} style={{ cursor: 'pointer' }}>
              <span className={styles.sectionTitle}>STATS</span>
              <span className={styles.collapseIcon}>{statsOpen ? '−' : '+'}</span>
              <div className={styles.sectionLine}/>
            </div>
            {statsOpen && (<>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <img className={styles.statBoxIcon} src="/icons/stats/hp.webp" alt="HP"/>
                    <input className={styles.numberInput} type="number" value={project.stats.hp} onChange={(e) => setStats({ hp: Number(e.target.value) || 0 })} min={1} max={999}/>
                    <span className={styles.statLbl}>HP</span>
                  </div>
                  <div className={styles.statBox}>
                    <img className={styles.statBoxIcon} src="/icons/stats/speed.webp" alt="Speed"/>
                    <div className={styles.speedRow}>
                      <input className={styles.speedInput} type="number" value={project.stats.speedMin} onChange={(e) => setStats({ speedMin: Number(e.target.value) || 0 })} min={1} max={9}/>
                      <span className={styles.speedDash}>–</span>
                      <input className={styles.speedInput} type="number" value={project.stats.speedMax} onChange={(e) => setStats({ speedMax: Number(e.target.value) || 0 })} min={1} max={9}/>
                    </div>
                    <span className={styles.statLbl}>SPD</span>
                  </div>
                  <div className={styles.statBox}>
                    <img className={styles.statBoxIcon} src="/icons/stats/defense.webp" alt="DEF"/>
                    <input className={styles.numberInput} type="number" value={project.stats.defenseLevel} onChange={(e) => setStats({ defenseLevel: Number(e.target.value) || 0 })} min={1} max={99}/>
                    <span className={styles.statLbl}>DEF</span>
                  </div>
                </div>
                <div className={styles.resistGrid}>
                  {ALL_DAMAGE_TYPES.map((dmg) => (<div key={dmg} className={styles.resistBox}>
                      <img className={styles.resistIcon} src={`/icons/attack/${dmg}.png`} alt={dmg}/>
                      <span className={styles.resistLabel}>{DAMAGE_LABELS[dmg]}</span>
                      <select className={styles.resistSelect} value={project.stats.resistances[dmg]} onChange={(e) => setResistances({ [dmg]: e.target.value as ResistanceLevel })} style={{ color: `var(--res-${project.stats.resistances[dmg]})` }}>
                        {ALL_RESISTANCE_LEVELS.map((lvl) => (<option key={lvl} value={lvl}>{RESISTANCE_LABELS[lvl]}</option>))}
                      </select>
                    </div>))}
                </div>
              </>)}
          </div>

          <div className={styles.editorSection}>
            <div className={styles.sectionHeader} onClick={() => setSanityOpen(!sanityOpen)} style={{ cursor: 'pointer' }}>
              <span className={styles.sectionTitle}>SANITY</span>
              <span className={styles.collapseIcon}>{sanityOpen ? '−' : '+'}</span>
              <div className={styles.sectionLine}/>
            </div>
            {sanityOpen && (<div className={styles.fieldGroup}>
                
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Panic</span>
                  <input className={styles.inputField} type="text" value={project.sanity.panicName} onChange={(e) => setSanity({ panicName: e.target.value })} placeholder="Panic name"/>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Icon</span>
                  <div className={styles.sinnerIconField}>
                    {project.sanity.panicIconUrl && (<img className={styles.sinnerIconPreview} src={project.sanity.panicIconUrl} alt="Panic icon"/>)}
                    <button className={styles.smallBtn} onClick={() => setPanicPickerOpen(!panicPickerOpen)} type="button">
                      {project.sanity.panicIconUrl ? 'Change' : 'Select'}
                    </button>
                    {project.sanity.panicIconUrl && (<button className={styles.smallBtnDanger} onClick={() => setSanity({ panicIconUrl: null })} type="button">x</button>)}
                  </div>
                </div>
                {panicPickerOpen && (<div className={styles.sinnerGrid}>
                    {MENTAL_ICONS.map((mi) => (<img key={mi.id} className={`${styles.sinnerGridIcon} ${project.sanity.panicIconUrl === mi.path ? styles.sinnerGridIconActive : ''}`} src={mi.path} alt={mi.id} title={mi.id} onClick={() => { setSanity({ panicIconUrl: mi.path }); setPanicPickerOpen(false); }}/>))}
                    <button className={styles.sinnerUploadBtn} onClick={() => panicFileRef.current?.click()} type="button" title="Upload custom icon">+</button>
                    <input ref={panicFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePanicIconUpload}/>
                  </div>)}

                <div className={styles.field} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.fieldLabel}>Low Morale</span>
                  <textarea className={styles.textareaField} value={project.sanity.lowMoraleDesc} onChange={(e) => setSanity({ lowMoraleDesc: e.target.value })} placeholder="Low morale description" rows={2}/>
                </div>

                <div className={styles.field} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.fieldLabel}>Panic</span>
                  <textarea className={styles.textareaField} value={project.sanity.panicDesc} onChange={(e) => setSanity({ panicDesc: e.target.value })} placeholder="Panic effect description" rows={2}/>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Title Color</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="color" value={project.sanity.sanityTextColor || '#e8e4dc'} onChange={(e) => setSanity({ sanityTextColor: e.target.value })} style={{ width: '24px', height: '24px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}/>
                    <input className={styles.inputField} type="text" value={project.sanity.sanityTextColor || '#e8e4dc'} onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
                        setSanity({ sanityTextColor: v || '#e8e4dc' });
                    }
                }} placeholder="#e8e4dc" style={{ width: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}/>
                  </div>
                </div>

                <div className={styles.field} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
                  <span className={styles.fieldLabel} style={{ color: '#4a9fd8' }}>Factors Increasing</span>
                  {project.sanity.factorsIncreasing.map((f, i) => (<div key={i} style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input className={styles.inputField} type="text" value={f} onChange={(e) => updateSanityFactor('increasing', i, e.target.value)} style={{ textAlign: 'left' }}/>
                      <button className={styles.smallBtnDanger} onClick={() => removeSanityFactor('increasing', i)} type="button">x</button>
                    </div>))}
                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <input className={styles.inputField} type="text" value={incFactorInput} onChange={(e) => setIncFactorInput(e.target.value)} onKeyDown={(e) => {
                    if (e.key === 'Enter' && incFactorInput.trim()) {
                        e.preventDefault();
                        addSanityFactor('increasing', incFactorInput.trim());
                        setIncFactorInput('');
                    }
                }} placeholder="Type + Enter" style={{ textAlign: 'left' }}/>
                    <button className={styles.smallBtn} onClick={() => {
                    if (incFactorInput.trim()) {
                        addSanityFactor('increasing', incFactorInput.trim());
                        setIncFactorInput('');
                    }
                }} type="button">+</button>
                  </div>
                </div>

                <div className={styles.field} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
                  <span className={styles.fieldLabel} style={{ color: '#c83232' }}>Factors Decreasing</span>
                  {project.sanity.factorsDecreasing.map((f, i) => (<div key={i} style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input className={styles.inputField} type="text" value={f} onChange={(e) => updateSanityFactor('decreasing', i, e.target.value)} style={{ textAlign: 'left' }}/>
                      <button className={styles.smallBtnDanger} onClick={() => removeSanityFactor('decreasing', i)} type="button">x</button>
                    </div>))}
                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <input className={styles.inputField} type="text" value={decFactorInput} onChange={(e) => setDecFactorInput(e.target.value)} onKeyDown={(e) => {
                    if (e.key === 'Enter' && decFactorInput.trim()) {
                        e.preventDefault();
                        addSanityFactor('decreasing', decFactorInput.trim());
                        setDecFactorInput('');
                    }
                }} placeholder="Type + Enter" style={{ textAlign: 'left' }}/>
                    <button className={styles.smallBtn} onClick={() => {
                    if (decFactorInput.trim()) {
                        addSanityFactor('decreasing', decFactorInput.trim());
                        setDecFactorInput('');
                    }
                }} type="button">+</button>
                  </div>
                </div>
              </div>)}
          </div>

          <div className={styles.editorSection}>
            <div className={styles.sectionHeader} onClick={() => setDetailsOpen(!detailsOpen)} style={{ cursor: 'pointer' }}>
              <span className={styles.sectionTitle}>DETAILS</span>
              <span className={styles.collapseIcon}>{detailsOpen ? '−' : '+'}</span>
              <div className={styles.sectionLine}/>
            </div>
            {detailsOpen && <div className={styles.fieldGroup}>
              <div className={styles.field} style={{ alignItems: 'flex-start' }}>
                <span className={styles.fieldLabel}>Traits</span>
                <div style={{ flex: 1 }}>
                  <input className={styles.inputField} type="text" value={traitInput} onChange={(e) => setTraitInput(e.target.value)} onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTrait(traitInput);
                        setTraitInput('');
                    }
                }} placeholder="Type tag + Enter"/>
                  {project.traits.length > 0 && (<div className={styles.tagList}>
                      {project.traits.map((tag, i) => (<span key={i} className={`${styles.tagChip} ${traitStruck(tag) ? styles.tagChipStruck : ''}`}>
                          <button className={styles.tagLabel} type="button" onClick={() => toggleTraitStruck(i)} title={traitStruck(tag)
                            ? 'Currently marked as no longer associated - click to restore'
                            : 'Mark as no longer associated'}>
                            {traitLabel(tag)}
                          </button>
                          <button className={styles.tagRemove} onClick={() => removeTrait(i)} type="button">&times;</button>
                        </span>))}
                    </div>)}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Mirror</span>
                <div className={styles.sinnerIconField}>
                  {project.mirrorWorldIconUrl && (<img className={styles.portraitPreview} src={project.mirrorWorldIconUrl} alt="Mirror World"/>)}
                  <button className={styles.smallBtn} onClick={() => setMirrorPickerOpen(!mirrorPickerOpen)} type="button">
                    {project.mirrorWorldIconUrl ? 'Change' : 'Select'}
                  </button>
                  {project.mirrorWorldIconUrl && (<button className={styles.smallBtnDanger} onClick={() => { setMirrorWorldIconUrl(null); setMirrorWorldName(''); }} type="button">x</button>)}
                </div>
              </div>
              {mirrorPickerOpen && (<div className={styles.sinnerGrid}>
                  {MIRROR_WORLD_ICONS.map((mw) => (<img key={mw.id} className={`${styles.sinnerGridIcon} ${project.mirrorWorldIconUrl === mw.path ? styles.sinnerGridIconActive : ''}`} src={mw.path} alt={mw.label} title={mw.label} onClick={() => { setMirrorWorldIconUrl(mw.path); setMirrorWorldName(mw.label); setMirrorPickerOpen(false); }}/>))}
                  <button className={styles.sinnerUploadBtn} onClick={() => mirrorFileRef.current?.click()} type="button" title="Upload custom icon">+</button>
                  <input ref={mirrorFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMirrorUpload}/>
                </div>)}
              {project.mirrorWorldIconUrl && (<div className={styles.field}>
                  <span className={styles.fieldLabel}>M. Name</span>
                  <input className={styles.inputField} type="text" value={project.mirrorWorldName ?? ''} onChange={(e) => setMirrorWorldName(e.target.value)} placeholder="Mirror world name"/>
                </div>)}

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Caution</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="color" value={project.cautionColor || '#6b5c40'} onChange={(e) => setCautionColor(e.target.value)} style={{ width: '24px', height: '24px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}/>
                  <input className={styles.inputField} type="text" value={project.cautionColor || '#6b5c40'} onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
                        setCautionColor(v || '#6b5c40');
                    }
                }} placeholder="#6b5c40" style={{ width: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}/>
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Info BG</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="color" value={project.infoBarBgColor || '#1a1714'} onChange={(e) => setInfoBarBgColor(e.target.value)} style={{ width: '24px', height: '24px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}/>
                  <input className={styles.inputField} type="text" value={project.infoBarBgColor || '#1a1714'} onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
                        setInfoBarBgColor(v || '#1a1714');
                    }
                }} placeholder="#1a1714" style={{ width: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}/>
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Skill BG</span>
                <div className={styles.sinnerIconField}>
                  {project.rightColumnBgUrl && (<img className={styles.portraitPreview} src={project.rightColumnBgUrl} alt="Skill BG"/>)}
                  <button className={styles.smallBtn} onClick={() => setBgPickerOpen(!bgPickerOpen)} type="button">
                    {project.rightColumnBgUrl ? 'Change' : 'Select'}
                  </button>
                  {project.rightColumnBgUrl && (<button className={styles.smallBtnDanger} onClick={() => setRightColumnBgUrl(null)} type="button">x</button>)}
                </div>
              </div>
              {project.rightColumnBgUrl && (<div className={styles.field}>
                  <span className={styles.fieldLabel}>Opacity</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input type="range" min={0} max={100} value={Math.round((project.rightColumnBgOpacity ?? 0.15) * 100)} onChange={(e) => setRightColumnBgOpacity(Number(e.target.value) / 100)} className={styles.rangeSlider}/>
                    <span className={styles.rangeValue}>{Math.round((project.rightColumnBgOpacity ?? 0.15) * 100)}%</span>
                  </div>
                </div>)}
              {bgPickerOpen && (<div className={styles.bgGrid}>
                  {BACKGROUNDS.map((bg) => (<div key={bg.id} className={`${styles.bgGridItem} ${project.rightColumnBgUrl === bg.path ? styles.bgGridItemActive : ''}`} onClick={() => { setRightColumnBgUrl(bg.path); setBgPickerOpen(false); }} title={bg.label}>
                      <img className={styles.bgGridImg} src={bg.path} alt={bg.label} loading="lazy"/>
                    </div>))}
                  <button className={styles.sinnerUploadBtn} onClick={() => bgFileRef.current?.click()} type="button" title="Upload custom background">+</button>
                  <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload}/>
                </div>)}
            </div>}
          </div>

          <div className={styles.editorSection}>
            <div className={styles.sectionHeader} onClick={() => setEntriesOpen(!entriesOpen)} style={{ cursor: 'pointer' }}>
              <span className={styles.sectionTitle}>ENTRIES</span>
              <span className={styles.collapseIcon}>{entriesOpen ? '−' : '+'}</span>
              <div className={styles.sectionLine}/>
            </div>
            {entriesOpen && (<EntryList project={project} selectedEntry={selectedEntry} onSelect={setSelectedEntry} onAddSkill={addSkill} onRemoveSkill={removeSkill} onAddDefense={addDefenseSkill} onRemoveDefense={removeDefenseSkill} onAddPassive={addPassive} onRemovePassive={removePassive}/>)}
          </div>

          {selectedEntry && (<div className={styles.editorSection}>
              <div className={styles.sectionHeader} onClick={() => setEditorOpen(!editorOpen)} style={{ cursor: 'pointer' }}>
                <span className={styles.sectionTitle}>EDITOR</span>
                <span className={styles.collapseIcon}>{editorOpen ? '−' : '+'}</span>
                <div className={styles.sectionLine}/>
              </div>
              {editorOpen && renderEntryEditor()}
            </div>)}
          </>)}
        </div>

        <div className={styles.sidebarFooter}>
          <span className={styles.creditLine}>developed by Nyrrine</span>
          <span className={styles.creditLine}>made with love for Hyacinth</span>
        </div>
      </aside>

      <div className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`} onMouseDown={handleResizeStart}/>

      <main className={styles.viewport} ref={viewportRef}>
        
        <div className={`${styles.bgLayer} ${styles.bgMaker} ${activeTool === 'maker' ? styles.bgLayerActive : ''}`}/>
        <div className={`${styles.bgLayer} ${styles.bgSaves} ${activeTool === 'saves' ? styles.bgLayerActive : ''}`}/>
        <div className={`${styles.bgLayer} ${styles.bgStory} ${activeTool === 'story' ? styles.bgLayerActive : ''}`}/>
        <div className={`${styles.bgLayer} ${styles.bgWiki} ${activeTool === 'wiki' ? styles.bgLayerActive : ''}`}/>

        {activeTool === 'maker' ? (<div className={styles.previewContainer}>
            <div className={styles.cardWrapper} style={{ transform: `scale(${scale})` }}>
              <CardRenderer data={project} leftTab={leftTab} onTabChange={setLeftTab}/>
            </div>
          </div>) : activeTool === 'saves' ? null : activeTool === 'wiki' ? (<div className={styles.wikiViewport}>
            <div className={styles.wikiViewportInner}>
              <div className={styles.wikiViewportHeader}>
                <h2 className={styles.wikiViewportTitle}>Lore Wiki</h2>
                
                <input className={styles.wikiViewportSearch} type="search" value={wikiSearch} onChange={(e) => setWikiSearch(e.target.value)} placeholder="Search the wiki..." aria-label="Search the wiki"/>
              </div>
              
              <Suspense fallback={<p className={styles.wikiViewportMuted}>Loading...</p>}>
                <WikiBrowser embedded confirmLeave={confirmLeaveEditor} search={wikiSearch} onSearchChange={setWikiSearch}/>
              </Suspense>
            </div>
          </div>) : (<div className={styles.wipViewport}>
            <h2 className={styles.wipTitle}>{WIP_TITLES[activeTool]}</h2>
            <div className={styles.wipDivider}/>
            <p className={styles.wipSubtitle}>Coming Soon</p>
          </div>)}
      </main>

      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)}/>

      {artPickerSkillId && (<Suspense fallback={null}>
        <SkillArtPicker onSelect={(icon) => {
                const isDefense = project.defenseSkills.some((d) => d.id === artPickerSkillId);
                if (isDefense) {
                    updateDefenseSkill(artPickerSkillId, { skillIconUrl: icon.path });
                }
                else {
                    updateSkill(artPickerSkillId, { skillIconUrl: icon.path });
                }
                setArtPickerSkillId(null);
            }} onClose={() => setArtPickerSkillId(null)}/>
        </Suspense>)}

      {detailProjectId && user && (<ProjectDetailModal key={detailProjectId} projectId={detailProjectId} userId={user.id} onClose={() => setDetailProjectId(null)} onEdit={(data, projectId) => {
                if (isDirty && !window.confirm('You have unsaved changes. Load this identity instead?'))
                    return;
                loadProjectInStore(data, projectId);
                setDetailProjectId(null);
                setActiveTool('maker');
            }} onDeleted={() => {
                setDetailProjectId(null);
                setSavesRefreshKey((k) => k + 1);
            }}/>)}
    </div>);
}
