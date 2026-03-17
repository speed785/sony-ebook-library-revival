import { assetUrl } from "../utils";

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 2.5c.1 1-.2 2-1 2.8-.8.8-1.8 1.2-2.7 1.2-.1-1 .3-2 1-2.7.8-.8 1.8-1.3 2.7-1.3Zm3 12.8c-.4 1-1 2-1.8 3-.9 1-1.8 2-3.2 2-1.2 0-1.6-.7-3-.7-1.3 0-1.8.7-3 .7-1.3 0-2.3-.9-3.2-2-.9-1-1.6-2.3-2-3.6C1.4 12.4 2 10 3.4 8.7 4.4 7.7 5.6 7 6.9 7c1.2 0 2 .8 3 .8 1 0 1.7-.8 3.1-.8 1.1 0 2.2.5 3.1 1.3-.7.4-2.1 1.5-2.1 3.6 0 2.5 2.2 3.4 2.5 3.5Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.2-3.5-1.2-.5-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.2-4.7-5 0-1.1.4-2 1-2.8 0-.2-.4-1.3.1-2.7 0 0 .9-.3 2.9 1a10 10 0 0 1 5.2 0c2-1.3 2.9-1 2.9-1 .5 1.4.2 2.5.1 2.7.7.8 1 1.7 1 2.8 0 3.8-2.4 4.7-4.7 5 .4.3.8 1 .8 2v3c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function Website() {
  return (
    <main className="site-shell">
      <section className="site-hero">
        <div className="site-hero__copy">
          <h1>Sony eBook Library Revival</h1>
          <p>
            A modern desktop app for classic Sony Readers. It keeps local book
            transfer and on-device browsing usable on current Macs without
            leaning on abandoned store-era software.
          </p>
          <div className="site-meta">
            <span>Made for macOS</span>
            <span>Classic PRS workflow</span>
            <span>Open source</span>
          </div>
          <div className="site-actions">
            <a
              className="primary site-link"
              href="https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg"
            >
              <AppleIcon />
              Download for Mac
            </a>
            <a
              className="secondary site-link"
              href="https://github.com/speed785/sony-ebook-library-revival"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              View the repo
            </a>
          </div>
        </div>
        <figure className="site-shot site-shot--hero">
          <img
            src={assetUrl("screenshots/app-overview.png")}
            alt="Sony eBook Library Revival app overview"
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
              This project is for older Sony readers that still have a place in
              a modern reading workflow. It focuses on local device access,
              direct transfer, and a quieter interface that stays out of the
              way.
            </p>
          </div>
        </div>
      </section>

      <section className="site-gallery">
        <figure className="site-shot site-shot--wide">
          <img
            src={assetUrl("screenshots/app-library.png")}
            alt="Sony eBook Library Revival library browser"
          />
        </figure>
        <div className="site-gallery__copy">
          <p className="eyebrow">Reading workflow</p>
          <h2>Designed more like a reading tool than a utility window.</h2>
          <p>
            Browse the device clearly, inspect folders without getting lost, and
            move books in or out with a layout that feels closer to a document
            app than a legacy launcher.
          </p>
        </div>
      </section>

      <section className="site-rows">
        <article className="site-row">
          <div className="site-row__label">App</div>
          <div className="site-row__body">
            <h3>Built around direct access to the reader.</h3>
            <p>
              Connect the device, browse its library, inspect folders, export
              files, and move books across without sending the workflow through
              a storefront or sync service.
            </p>
          </div>
        </article>
        <article className="site-row">
          <div className="site-row__label">Formats</div>
          <div className="site-row__body">
            <h3>Made for the formats these devices still handle well.</h3>
            <p>
              EPUB remains the clearest path for day-to-day reading. PDFs can be
              managed too, with Calibre still useful when conversion or cleanup
              is needed.
            </p>
          </div>
        </article>
        <article className="site-row">
          <div className="site-row__label">Origin</div>
          <div className="site-row__body">
            <h3>
              A clean-room remake of a setup flow that no longer belongs on
              modern Macs.
            </h3>
            <p>
              The project is informed by the original Sony launcher era, but it
              is rebuilt for current systems with Tauri, TypeScript, and a more
              durable local-first approach.
            </p>
          </div>
        </article>
      </section>

      <section className="site-download-band">
        <p className="eyebrow">Download</p>
        <div className="site-download-band__content">
          <div>
            <h2>Download the latest macOS release.</h2>
            <p>
              Get the current DMG, connect your Sony Reader over USB, and use
              the desktop app to browse and move books with less friction.
            </p>
          </div>
          <a
            className="primary site-link site-link--large"
            href="https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg"
          >
            <AppleIcon />
            Download for Mac
          </a>
        </div>
      </section>
    </main>
  );
}
