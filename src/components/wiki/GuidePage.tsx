import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { WikiLayout } from './WikiLayout';
import styles from './GuidePage.module.css';
export function GuidePage() {
    const { hash } = useLocation();
    useEffect(() => {
        if (hash) {
            const id = hash.replace('#', '');
            const el = document.getElementById(id);
            if (el) {
                requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
            }
        }
    }, [hash]);
    return (<WikiLayout breadcrumbs={[{ label: 'Guides' }, { label: 'User Guide' }]}>
      <article className={styles.page}>
        
        <header className={styles.header}>
          <h1 className={styles.title}>User Guide</h1>
          <p className={styles.subtitle}>
            Everything you need to know about building identity cards and character wiki pages.
          </p>
          <div className={styles.headerDivider}/>
        </header>

        <nav id="toc" className={styles.toc}>
          <h2 className={styles.tocTitle}>Contents</h2>
          <div className={styles.tocColumns}>
            <div>
              <div className={styles.tocGroup}>
                <div className={styles.tocGroupLabel}>Rich Text Formatting</div>
                <a href="#tokens" className={styles.tocLink}>Status Tokens</a>
                <a href="#keywords" className={styles.tocLink}>Keywords</a>
                <a href="#colored-text" className={styles.tocLink}>Colored Text</a>
                <a href="#formatting" className={styles.tocLink}>Bold &amp; Italic</a>
                <a href="#where-it-works" className={styles.tocLink}>Where It Works</a>
              </div>
              <div className={styles.tocGroup}>
                <div className={styles.tocGroupLabel}>Wiki Pages</div>
                <a href="#creating-pages" className={styles.tocLink}>Creating &amp; Editing</a>
                <a href="#section-types" className={styles.tocLink}>Section Types</a>
                <a href="#wiki-colors" className={styles.tocLink}>Customizing Colors</a>
                <a href="#sharing" className={styles.tocLink}>Sharing</a>
                <a href="#identity-showcase" className={styles.tocLink}>Identity Showcase</a>
              </div>
            </div>
            <div>
              <div className={styles.tocGroup}>
                <a href="#custom-statuses" className={styles.tocLink}>Custom Status Effects</a>
              </div>
              <div className={styles.tocGroup}>
                <a href="#saving" className={styles.tocLink}>Saving Your Work</a>
              </div>
              <div className={styles.tocGroup}>
                <a href="#shortcuts" className={styles.tocLink}>Keyboard Shortcuts</a>
              </div>
              <div className={styles.tocGroup}>
                <a href="#about" className={styles.tocLink}>About</a>
              </div>
            </div>
          </div>
        </nav>

        <section id="rich-text" className={styles.section}>
          <h2 className={styles.sectionHeading}>Rich Text Formatting</h2>
          <p className={styles.paragraph}>
            The editor supports rich text with inline status icons, colored keywords, hex-colored
            text, and standard formatting. Here's how each feature works.
          </p>

          <div id="tokens" className={styles.subSection}>
            <h3 className={styles.subHeading}>Status Tokens</h3>
            <p className={styles.paragraph}>
              Type <code className={styles.code}>:</code> followed by a status name to open the
              autocomplete dropdown. Select a status to insert its icon with a colored label.
              There are over 888 built-in statuses, plus any custom ones you've created.
            </p>
            <div className={styles.tip}>
              Try typing <code>:bleed:</code> or <code>:burn:</code> in any rich text field to
              see the autocomplete in action. After inserting a token, click on it to change its
              display color.
            </div>
          </div>

          <div id="keywords" className={styles.subSection}>
            <h3 className={styles.subHeading}>Keywords</h3>
            <p className={styles.paragraph}>
              Type <code className={styles.code}>[</code> followed by a keyword to open the
              keyword autocomplete. Selecting a keyword inserts colored bracket text.
            </p>
            <p className={styles.paragraph}>
              Common keywords include: <strong className={styles.strong}>On Hit</strong>,{' '}
              <strong className={styles.strong}>On Use</strong>,{' '}
              <strong className={styles.strong}>On Crit</strong>,{' '}
              <strong className={styles.strong}>On Kill</strong>,{' '}
              <strong className={styles.strong}>On Evade</strong>,{' '}
              <strong className={styles.strong}>After Attack</strong>,{' '}
              <strong className={styles.strong}>Before Attack</strong>, and{' '}
              <strong className={styles.strong}>Reuse Coin</strong>.
            </p>
            <div className={styles.tip}>
              You can also create custom keywords - just type any text after{' '}
              <code>[</code> and select "Create [...]" from the dropdown.
            </div>
          </div>

          <div id="colored-text" className={styles.subSection}>
            <h3 className={styles.subHeading}>Colored Text</h3>
            <p className={styles.paragraph}>
              Wrap text in a hex color code to display it in that color. The syntax is:{' '}
              <code className={styles.code}>{'{#hex:your text here}'}</code>
            </p>
            <p className={styles.paragraph}>
              The <code className={styles.code}>{'{#hex:'}</code> prefix and closing{' '}
              <code className={styles.code}>{'}'}</code> are hidden in the final output - only
              the colored text is visible.
            </p>
            <div className={styles.tip}>
              Examples: <code>{'{#ff0000:critical damage}'}</code> for{' '}
              <span style={{ color: '#ff0000' }}>critical damage</span>,{' '}
              <code>{'{#4488ff:shield effect}'}</code> for{' '}
              <span style={{ color: '#4488ff' }}>shield effect</span>,{' '}
              <code>{'{#d4a843:golden text}'}</code> for{' '}
              <span style={{ color: '#d4a843' }}>golden text</span>.
            </div>
          </div>

          <div id="formatting" className={styles.subSection}>
            <h3 className={styles.subHeading}>Bold &amp; Italic</h3>
            <p className={styles.paragraph}>
              Use <kbd>Ctrl+B</kbd> to toggle bold and <kbd>Ctrl+I</kbd> to toggle italic on
              selected text. Both work in combination with tokens and colored text.
            </p>
          </div>

          <div id="where-it-works" className={styles.subSection}>
            <h3 className={styles.subHeading}>Where It Works</h3>
            <p className={styles.paragraph}>
              Rich text formatting is supported in the following areas:
            </p>
            <p className={styles.paragraph}>
              <strong className={styles.strong}>Card Editor</strong>
            </p>
            <ul className={styles.list}>
              <li>Skill effects</li>
              <li>Coin effects</li>
              <li>Passive descriptions</li>
            </ul>
            <p className={styles.paragraph}>
              <strong className={styles.strong}>Wiki Pages</strong>
            </p>
            <ul className={styles.list}>
              <li>Text sections</li>
              <li>Collapsible sections</li>
              <li>Infobox field values</li>
              <li>Quote text</li>
              <li>Stat table values</li>
              <li>Image gallery captions</li>
            </ul>
          </div>
        </section>

        <section id="wiki-pages" className={styles.section}>
          <h2 className={styles.sectionHeading}>Wiki Pages</h2>

          <div id="creating-pages" className={styles.subSection}>
            <h3 className={styles.subHeading}>Creating &amp; Editing</h3>
            <p className={styles.paragraph}>
              Go to the <strong className={styles.strong}>Wiki</strong> tab in the sidebar and
              click <strong className={styles.strong}>Create Page</strong>. This opens the wiki
              builder with a sidebar for settings and a live preview. Set your page title, URL
              slug, subtitle, and cover image from the settings panel.
            </p>
          </div>

          <div id="section-types" className={styles.subSection}>
            <h3 className={styles.subHeading}>Section Types</h3>
            <p className={styles.paragraph}>
              Wiki pages are built from sections. Each section type serves a different purpose:
            </p>
            <ul className={styles.sectionTypeList}>
              <li>
                <strong className={styles.strong}>Infobox</strong> - Character portrait with
                key-value info fields (name, faction, etc.)
              </li>
              <li>
                <strong className={styles.strong}>Text</strong> - Rich text block with a
                heading, the main content workhorse
              </li>
              <li>
                <strong className={styles.strong}>Image Gallery</strong> - Grid of images with
                optional captions
              </li>
              <li>
                <strong className={styles.strong}>Identity Showcase</strong> - Displays your
                saved identity cards in a gallery
              </li>
              <li>
                <strong className={styles.strong}>Collapsible</strong> - Expandable section for
                spoilers or extra details
              </li>
              <li>
                <strong className={styles.strong}>Divider</strong> - Visual separator (gold,
                thin, or ornamental styles)
              </li>
              <li>
                <strong className={styles.strong}>Quote</strong> - Styled quote block with
                attribution
              </li>
              <li>
                <strong className={styles.strong}>Stat Table</strong> - Key-value table for
                stats, traits, etc.
              </li>
            </ul>
          </div>

          <div id="wiki-colors" className={styles.subSection}>
            <h3 className={styles.subHeading}>Customizing Colors</h3>
            <p className={styles.paragraph}>
              Each section type has color pickers for headings, borders, labels, and text.
              You can also set global page styles - background color, accent color, text color,
              and font - which cascade through all sections on the page.
            </p>
          </div>

          <div id="sharing" className={styles.subSection}>
            <h3 className={styles.subHeading}>Sharing</h3>
            <p className={styles.paragraph}>
              Toggle <strong className={styles.strong}>Published</strong> on your page, then
              copy the shareable link. Published pages are accessible by anyone with the direct
              URL, but are not publicly listed anywhere.
            </p>
          </div>

          <div id="identity-showcase" className={styles.subSection}>
            <h3 className={styles.subHeading}>Identity Showcase</h3>
            <p className={styles.paragraph}>
              Link your saved identity card projects to a wiki page using the Identity Showcase
              section. It displays them as gacha-style cards that visitors can click to preview.
              You can also set up detail pages for each identity.
            </p>
          </div>
        </section>

        <section id="custom-statuses" className={styles.section}>
          <h2 className={styles.sectionHeading}>Custom Status Effects</h2>
          <p className={styles.paragraph}>
            Create your own status effects from the{' '}
            <strong className={styles.strong}>Wiki</strong> tab under{' '}
            <strong className={styles.strong}>My Statuses</strong>. Each status has a name, a
            key (used for <code className={styles.code}>:key:</code> autocomplete), an
            uploadable icon, and a classification.
          </p>
          <p className={styles.paragraph}>
            There are four classifications, each with its own color:
          </p>
          <ul className={styles.list}>
            <li><span className={styles.classStandard}>Standard</span> - brown</li>
            <li><span className={styles.classNeutral}>Neutral</span> - yellow</li>
            <li><span className={styles.classPositive}>Positive</span> - green</li>
            <li><span className={styles.classNegative}>Negative</span> - red</li>
          </ul>
          <p className={styles.paragraph}>
            Once created, your custom statuses appear in the{' '}
            <code className={styles.code}>:token:</code> autocomplete alongside the built-in
            ones.
          </p>
        </section>

        <section id="saving" className={styles.section}>
          <h2 className={styles.sectionHeading}>Saving Your Work</h2>
          <p className={styles.paragraph}>
            Sign in to save your identity cards and wiki pages to the cloud.
          </p>
          <ul className={styles.list}>
            <li>
              <strong className={styles.strong}>Save New</strong> creates a new save;{' '}
              <strong className={styles.strong}>Overwrite</strong> updates an existing one.
            </li>
            <li>
              Images are uploaded automatically when you save (10 MB limit per image).
            </li>
            <li>
              Use the <strong className={styles.strong}>Export</strong> button to download your
              card as a PNG image.
            </li>
          </ul>
        </section>

        <section id="shortcuts" className={styles.section}>
          <h2 className={styles.sectionHeading}>Keyboard Shortcuts</h2>
          <table className={styles.shortcutTable}>
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd>Ctrl + B</kbd></td>
                <td>Bold</td>
              </tr>
              <tr>
                <td><kbd>Ctrl + I</kbd></td>
                <td>Italic</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="about" className={styles.section}>
          <h2 className={styles.sectionHeading}>About</h2>
          <div className={styles.aboutCard}>
            <p className={styles.aboutText}>
              Limbus OC Maker is a fan-made identity card and character wiki creator for Limbus
              Company, built by Nyrrine. Not affiliated with or endorsed by Project Moon.
            </p>
            <div className={styles.aboutLinks}>
              <a href="https://discord.com/users/nyrrine" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                Discord - nyrrine
              </a>
              <a href="https://x.com/nyrrineross" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                X - @nyrrineross
              </a>
            </div>
            <p className={styles.aboutDisclaimer}>
              All Limbus Company assets are property of Project Moon.
            </p>
          </div>
        </section>
      </article>
    </WikiLayout>);
}
