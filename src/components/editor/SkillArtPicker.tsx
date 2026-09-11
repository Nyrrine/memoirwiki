import { useState, useMemo } from 'react';
import { SKILL_ART_CATEGORIES, searchSkillArt, type SkillArtIcon, type SkillArtCategory, type SkillArtSubcategory } from '../../lib/skillArtRegistry';
import styles from './SkillArtPicker.module.css';
interface SkillArtPickerProps {
    onSelect: (icon: SkillArtIcon) => void;
    onClose: () => void;
}
export function SkillArtPicker({ onSelect, onClose }: SkillArtPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCat, setSelectedCat] = useState<SkillArtCategory | null>(null);
    const [selectedSub, setSelectedSub] = useState<SkillArtSubcategory | null>(null);
    const searchResults = useMemo(() => {
        if (searchQuery.length < 2)
            return null;
        return searchSkillArt(searchQuery);
    }, [searchQuery]);
    const displayIcons = useMemo((): SkillArtIcon[] => {
        if (searchResults)
            return searchResults;
        if (selectedSub) {
            const fromGroups = selectedSub.groups.flatMap((g) => g.icons);
            return [...selectedSub.icons, ...fromGroups];
        }
        if (selectedCat) {
            const fromSubs = selectedCat.subcategories.flatMap((s) => [
                ...s.icons,
                ...s.groups.flatMap((g) => g.icons),
            ]);
            return [...selectedCat.icons, ...fromSubs];
        }
        return [];
    }, [searchResults, selectedCat, selectedSub]);
    return (<div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Skill Art</h3>
          <button className={styles.closeBtn} onClick={onClose} type="button">x</button>
        </div>

        <div className={styles.searchRow}>
          <input className={styles.searchInput} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search 2,844 icons..." autoFocus/>
        </div>

        <div className={styles.body}>
          
          {!searchResults && (<div className={styles.catSidebar}>
              {SKILL_ART_CATEGORIES.map((cat) => (<div key={cat.name}>
                  <button className={`${styles.catBtn} ${selectedCat?.name === cat.name ? styles.catBtnActive : ''}`} onClick={() => {
                    setSelectedCat(cat);
                    setSelectedSub(null);
                }} type="button">
                    {cat.name}
                    <span className={styles.catCount}>
                      {cat.icons.length + cat.subcategories.reduce((sum, s) => sum + s.icons.length + s.groups.reduce((gs, g) => gs + g.icons.length, 0), 0)}
                    </span>
                  </button>
                  {selectedCat?.name === cat.name && cat.subcategories.length > 0 && (<div className={styles.subList}>
                      {cat.subcategories.map((sub) => (<button key={sub.name} className={`${styles.subBtn} ${selectedSub?.name === sub.name ? styles.subBtnActive : ''}`} onClick={() => setSelectedSub(sub)} type="button">
                          {sub.name}
                        </button>))}
                    </div>)}
                </div>))}
            </div>)}

          <div className={styles.iconGrid}>
            {displayIcons.length === 0 && (<div className={styles.emptyGrid}>
                {searchQuery.length >= 2 ? 'No icons found' : 'Select a category'}
              </div>)}
            {displayIcons.map((icon) => (<img key={icon.id} className={styles.iconThumb} src={icon.path} alt={icon.label} title={icon.label} loading="lazy" onClick={() => onSelect(icon)}/>))}
          </div>
        </div>
      </div>
    </div>);
}
