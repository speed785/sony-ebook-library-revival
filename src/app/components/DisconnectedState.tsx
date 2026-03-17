export function DisconnectedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <section className="disconnected-state">
      <div className="disconnected-state__art" aria-hidden="true">
        <div className="device-illustration">
          <div className="device-illustration__screen" />
        </div>
      </div>
      <div className="disconnected-state__copy">
        <p className="eyebrow">Waiting for a reader</p>
        <h2>Connect your Sony Reader to begin.</h2>
        <p>
          Plug the device in over USB to browse its library, move books, and see
          storage details. Live information only appears when a reader is
          mounted on this computer.
        </p>
        <button className="primary" type="button" onClick={onRefresh}>
          Refresh device
        </button>
      </div>
    </section>
  );
}
