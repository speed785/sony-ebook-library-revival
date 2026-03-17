import { Download, ExternalLink, Zap } from "lucide-react";
import { assetUrl } from "../utils";

export function Website() {
  return (
    <main className="site-shell">
      <section className="site-hero">
        <div className="site-hero__copy">
          <div className="hero__badge-wrap">
            <img
              className="hero__brand"
              src={assetUrl("brand-mark.svg")}
              alt="Sony eBook Library Revival"
            />
            <span className="hero__badge">macOS · Free · Open source</span>
          </div>
          <h1>Sony eBook Library Revival</h1>
          <p>
            A modern desktop app for classic Sony Readers. Browse your device,
            preview books, and move files in and out — without relying on
            abandoned store-era software.
          </p>
          <div className="site-meta">
            <span>macOS 13+</span>
            <span>PRS-300 · PRS-505 · PRS-600 · more</span>
            <span>EPUB · PDF · LRF</span>
          </div>
          <div className="site-actions">
            <a
              className="primary site-link"
              href="https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg"
            >
              <Download size={17} />
              Download for Mac
            </a>
            <a
              className="secondary site-link"
              href="https://github.com/speed785/sony-ebook-library-revival"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
              View on GitHub
            </a>
          </div>
        </div>
        <figure className="site-shot site-shot--hero">
          <img
            src={assetUrl("screenshots/app-overview.png")}
            alt="Sony eBook Library Revival — app overview showing the library browser and details drawer"
          />
        </figure>
      </section>

      <section className="site-purpose">
        <p className="eyebrow">Why it exists</p>
        <div className="site-purpose__grid">
          <div>
            <h2>The hardware still works. The software should too.</h2>
          </div>
          <div>
            <p>
              Older Sony Readers still read EPUB and PDF perfectly well. This
              project keeps the useful part of that workflow alive — local
              device access, direct transfer, and a focused interface — without
              needing a storefront, a sync service, or a decade-old installer.
            </p>
          </div>
        </div>
      </section>

      <section className="site-gallery">
        <figure className="site-shot site-shot--wide">
          <img
            src={assetUrl("screenshots/app-library.png")}
            alt="Sony eBook Library Revival — library browser with collapsible navigation and file list"
          />
        </figure>
        <div className="site-gallery__copy">
          <p className="eyebrow">Reading workflow</p>
          <h2>Feels like a reading tool, not a legacy launcher.</h2>
          <p>
            Navigate your device with a collapsible tree, filter and sort by
            format, inspect folders and files in a slide-out drawer, and drag
            books to Finder directly from the interface. Every action stays
            close to the files you are working with.
          </p>
        </div>
      </section>

      <section className="site-rows">
        <article className="site-row">
          <div className="site-row__label">App</div>
          <div className="site-row__body">
            <h3>Direct access to the reader, nothing more.</h3>
            <p>
              Connect over USB, browse real book locations like
              <code>database/media/books</code>, preview EPUB covers and PDF
              thumbnails, and move files across without routing through any
              external service.
            </p>
          </div>
        </article>
        <article className="site-row">
          <div className="site-row__label">Performance</div>
          <div className="site-row__body">
            <h3>
              <Zap
                size={18}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: "6px",
                }}
              />
              Fast by default, not just at first launch.
            </h3>
            <p>
              The reader mount path and EPUB titles are cached in-memory for the
              session, so navigating directories and browsing your library
              doesn't re-run system commands on every click. Search is debounced
              and PDF previews are generated off the main thread.
            </p>
          </div>
        </article>
        <article className="site-row">
          <div className="site-row__label">Formats</div>
          <div className="site-row__body">
            <h3>Made for what these devices actually read.</h3>
            <p>
              EPUB is the primary path. PDFs work with full drawer previews. LRF
              files from the original Sony era are recognised and handled.
              Calibre remains useful alongside this app for conversion and
              metadata work.
            </p>
          </div>
        </article>
        <article className="site-row">
          <div className="site-row__label">Origin</div>
          <div className="site-row__body">
            <h3>
              A clean rebuild of a workflow that no longer runs on modern Macs.
            </h3>
            <p>
              Informed by the original Sony launcher era and the{" "}
              <code>Setup eBook Library.app</code> bundle, but rebuilt from
              scratch with Tauri 2, React 19, and Rust — built to last on
              current macOS, not to emulate the original.
            </p>
          </div>
        </article>
      </section>

      <section className="site-download-band">
        <p className="eyebrow">Download</p>
        <div className="site-download-band__content">
          <div>
            <h2>Get the latest macOS release.</h2>
            <p>
              Download the DMG, open it, drag the app to Applications, connect
              your Sony Reader over USB, and you're in.
            </p>
          </div>
          <a
            className="primary site-link site-link--large"
            href="https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg"
          >
            <Download size={17} />
            Download for Mac
          </a>
        </div>
      </section>
    </main>
  );
}
