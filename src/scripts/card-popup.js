(function (MemoryGame, EventDispatcher, $) { // Keeping `function` for stylistic reasons (all other classes use it)
  /** @constant {string} Selector matching natively focusable elements. */
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  /**
   * Custom dialog for a card.
   * Note: PopoverAPI not used, because older iOS versions don't support it but are long-lived.
   * Note: Anchor positioning not used, because browser support is still too low.
   * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
   * @class H5P.MemoryGame.CardPopup
   * @extends H5P.EventDispatcher
   * @param {object} l10n Localization strings.
   */
  class CardPopup extends EventDispatcher {
    constructor(l10n) {
      super();

      this.closed = undefined;
      this.inerted = [];
      this.isOpen = false;

      const backdrop = document.createElement('div');
      backdrop.className = 'h5p-memory-enlarge-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', () => {
        this.close(true);
      });
      this.backdrop = backdrop;

      const popup = document.createElement('div');
      popup.className = 'h5p-memory-enlarge-dialog';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-modal', 'true');
      popup.tabIndex = -1;
      this.popup = popup;

      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'h5p-memory-wrap';
      wrap.setAttribute('aria-label', l10n.shrinkCard);
      popup.appendChild(wrap);
      this.wrap = wrap;

      const card = document.createElement('div');
      card.className = 'h5p-memory-card h5p-memory-enlarge';
      wrap.appendChild(card);
      this.card = card;

      const content = document.createElement('div');
      content.className = 'h5p-memory-enlarge-content';
      card.appendChild(content);
      this.content = content;

      const indicator = document.createElement('div');
      indicator.className = 'h5p-memory-enlarge-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.inert = true;
      card.appendChild(indicator);

      popup.addEventListener('click', () => {
        this.close(true);
      });

      popup.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close(true);
          return;
        }

        this.trapFocus(event);
      });
    }

    /**
     * Make everything except the popup inert (or restore it).
     * @param {boolean} on True to make the background inert, false to restore.
     */
    setBackgroundInert(on) {
      if (on) {
        const parent = this.popup.parentElement;
        this.inerted = parent
          ? [...parent.children].filter((el) => el !== this.popup && el !== this.backdrop && !el.inert)
          : [];
        this.inerted.forEach((element) => {
          element.inert = true;
        });
      }
      else {
        this.inerted.forEach((element) => {
          element.inert = false;
        });
        this.inerted = [];
      }
    }

    /**
     * Keep Tab focus inside the dialog.
     * @param {KeyboardEvent} event
     */
    trapFocus(event) {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = [...this.popup.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const onTabStop = focusable.includes(active);

      if (event.shiftKey && (!onTabStop || active === first)) {
        last.focus();
        event.preventDefault();
      }
      else if (!event.shiftKey && (!onTabStop || active === last)) {
        first.focus();
        event.preventDefault();
      }
    }

    /**
     * Center the popup over the card it relates to, kept within the viewport.
     * Falls back to the CSS viewport centering when no anchor is given.
     * @param {HTMLElement} [anchor] The card element to center over.
     */
    positionOver(anchor) {
      const popup = this.popup;

      if (!anchor) {
        popup.style.margin = '';
        popup.style.inset = '';
        popup.style.left = '';
        popup.style.top = '';
        return;
      }

      const cardRect = anchor.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();

      const idealLeft = cardRect.left + (cardRect.width - popupRect.width) / 2;
      const idealTop = cardRect.top + (cardRect.height - popupRect.height) / 2;

      // Center over the card, but keep at least the configured margin from the viewport edges.
      const margin = 'var(--h5p-memory-enlarge-margin)';

      popup.style.margin = '0';
      popup.style.inset = 'auto';
      popup.style.left =
        `clamp(${margin}, ${idealLeft}px, calc(${window.innerWidth - popupRect.width}px - ${margin}))`;
      popup.style.top =
        `clamp(${margin}, ${idealTop}px, calc(${window.innerHeight - popupRect.height}px - ${margin}))`;
    }

    /**
     * Append popup to container.
     * @param {H5P.jQuery} $container Container to append to.
     */
    appendTo($container) {
      const container = $container.get(0);
      container.append(this.backdrop);
      container.append(this.popup);
    }

    /**
     * Show enlarged card.
     * @param {HTMLElement} node Cloned card content to display.
     * @param {function} done Callback invoked when dialog is closed.
     * @param {string} [styles] Inline style attribute string for card back.
     * @param {HTMLElement} [anchor] Card element to center popup over.
     * @param {string} [ariaLabel] Accessible label for dialog.
     */
    show(node, done, styles, anchor, ariaLabel) {
      const popup = this.popup;

      if (ariaLabel) {
        popup.setAttribute('aria-label', ariaLabel);
      }

      this.content.innerHTML = '';
      if (node) {
        this.content.appendChild(node);
      }

      // Start from not-playing state; the caller turns it on if the card's audio is set playing (see setAudioPlaying).
      this.setAudioPlaying(false);

      // Mirror the card back's optional background image onto the card surface.
      const match = typeof styles === 'string' ? styles.match(/url\((['"]?)(.*?)\1\)/) : null;
      this.card.style.backgroundImage = match ? `url("${match[2]}")` : '';

      this.closed = done;

      if (!this.isOpen) {
        this.isOpen = true;
        this.backdrop.classList.add('h5p-open');
        popup.classList.add('h5p-open');
        this.setBackgroundInert(true);
      }

      // Position once shown, so the popup has measurable dimensions.
      this.positionOver(anchor);

      this.wrap.focus();
    }

    /**
     * Close popup.
     * @param {boolean} refocus Sets focus after closing dialog
     */
    close(refocus) {
      if (this.isOpen) {
        this.isOpen = false;
        this.popup.classList.remove('h5p-open');
        this.backdrop.classList.remove('h5p-open');
      }

      // Restore the background before returning focus, so the focus target is no longer inert and can receive focus.
      this.setBackgroundInert(false);

      if (this.closed !== undefined) {
        const done = this.closed;
        this.closed = undefined;
        done(refocus);

        this.trigger('closed');
      }
    }

    /**
     * Set popup's font size so its card content scales with game like the on-board cards do.
     * @param {number} fontSizePx Font size in pixels.
     */
    setSize(fontSizePx) {
      this.popup.style.fontSize = `${fontSizePx}px`;
    }

    /**
     * Reflect related card's audio playing state, so cloned audio icon shows play/stop exactly like card on the board.
     * @param {boolean} playing True while the card's audio is playing.
     */
    setAudioPlaying(playing) {
      this.popup.classList.toggle('h5p-memory-audio-playing', playing);
    }
  }

  MemoryGame.CardPopup = CardPopup;
}(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery));
