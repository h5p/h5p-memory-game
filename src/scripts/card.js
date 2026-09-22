(function (MemoryGame, EventDispatcher, $) {
  /**
   * @private
   * @constant {number} WCAG_MIN_CONTRAST_AA_LARGE Minimum contrast ratio.
   * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
   */
  const WCAG_MIN_CONTRAST_AA_LARGE = 3;

  /**
   * Controls all the operations for each card.
   *
   * @class H5P.MemoryGame.Card
   * @extends H5P.EventDispatcher
   * @param {Object} image
   * @param {number} contentId
   * @param {number} cardsTotal Number of cards in total.
   * @param {string} alt
   * @param {Object} l10n Localization
   * @param {string} [description]
   * @param {Object} [styles]
   * @param {string} id Unique identifier for card including original+match info.
   */
  MemoryGame.Card = function (image, contentId, cardsTotal, alt, l10n, description, styles, audio, id) {
    /** @alias H5P.MemoryGame.Card# */

    this.id = id;

    // Keep track of tabbable state
    this.isTabbable = false;

    // Initialize event inheritance
    EventDispatcher.call(this);

    let path;
    let card;
    let wrapper;
    let cardImage;
    let audioButton;
    let removedState;
    let flippedState;
    let audioPlayer;
    let audioTooltip;

    /**
     * Process HTML escaped string for use as attribute value,
     * e.g. for alt text or title attributes.
     *
     * @param {string} value
     * @return {string} WARNING! Do NOT use for innerHTML.
     */
    const massageAttributeOutput = (value = 'Missing description') => {
      const dparser = new DOMParser().parseFromString(value, 'text/html');
      const div = document.createElement('div');
      div.innerHTML = dparser.documentElement.textContent;

      return div.textContent || div.innerText;
    };

    this.buildDOM = () => {
      const getButton = (className) => `<button aria-hidden="true" tabindex="-1" class="${className}"></button>`;
      const getAudioButton = () => `${audioPlayer ? getButton('h5p-memory-audio-button') : ''}`;

      wrapper = document.createElement('li');
      wrapper.className = 'h5p-memory-wrap';
      wrapper.innerHTML = `
        <div class="h5p-memory-card" tabindex="-1" role="button">
          <div class="h5p-front"${styles && styles.front ? styles.front : ''}>${styles && styles.backImage ? '' : '<span></span>'}</div>
          <div class="h5p-back"${styles && styles.back ? styles.back : ''}>${path ? `<img src="${path}" alt=""/>` : ''}</div>
        </div>
        <div class="h5p-memory-audio-container">
          ${path ? getAudioButton() : getButton('h5p-memory-audio-instead-of-image')}
        </div>
      `;

      wrapper.addEventListener('keydown', (event) => {
        switch (event.code) {
          case 'Enter':
          case 'Space':
            this.flip();
            event.preventDefault();
            return;
          case 'ArrowRight':
            // Move focus forward
            this.trigger('next');
            event.preventDefault();
            return;
          case 'ArrowDown':
            // Move focus down
            this.trigger('down');
            event.preventDefault();
            return;
          case 'ArrowLeft':
            // Move focus back
            this.trigger('prev');
            event.preventDefault();
            return;
          case 'ArrowUp': // Up
            // Move focus up
            this.trigger('up');
            event.preventDefault();
            return;
          case 'End':
            // Move to last card
            this.trigger('last');
            event.preventDefault();
            return;
          case 'Home':
            // Move to first card
            this.trigger('first');
            event.preventDefault();
            break;
          default:
            break;
        }
      });

      cardImage = wrapper.querySelector('img');

      card = wrapper.querySelector('.h5p-memory-card');
      wrapper.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.flip();
      });

      if (audioPlayer) {
        audioButton = wrapper.querySelector('.h5p-memory-audio-button, .h5p-memory-audio-instead-of-image');
        if (audioButton) {
          this.toggleAudioButton(l10n.playAudio);
          audioButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleAudio();
          });
          audioButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              this.toggleAudio();
            }
          });
        }
      }
    };

    // alt = alt || 'Missing description'; // Default for old games
    alt = massageAttributeOutput(alt);

    if (image && image.path) {
      path = H5P.getPath(image.path, contentId);
    }

    if (audio) {
      // Check if browser supports audio.
      audioPlayer = document.createElement('audio');
      if (audioPlayer.canPlayType !== undefined) {
        // Add supported source files.
        for (let i = 0; i < audio.length; i++) {
          if (audioPlayer.canPlayType(audio[i].mime)) {
            const source = document.createElement('source');
            source.src = H5P.getPath(audio[i].path, contentId);
            source.type = audio[i].mime;
            audioPlayer.appendChild(source);
          }
        }
      }

      if (!audioPlayer.children.length) {
        audioPlayer = null; // Not supported
      }
      else {
        audioPlayer.controls = false;
        audioPlayer.preload = 'auto';

        const handlePlaying = () => {
          if (card) {
            card.classList.add('h5p-memory-audio-playing');
            this.toggleAudioButton(l10n.pauseAudio);
            this.trigger('audioplay');
          }
        };
        const handleStopping = () => {
          if (card) {
            card.classList.remove('h5p-memory-audio-playing');
            this.toggleAudioButton(l10n.playAudio);
            this.trigger('audiostop');
          }
        };
        audioPlayer.addEventListener('play', handlePlaying);
        audioPlayer.addEventListener('ended', handleStopping);
        audioPlayer.addEventListener('pause', handleStopping);
      }
    }

    /**
     * Get id of the card.
     * @returns {string} The id of the card. (originalIndex-sideNumber)
     */
    this.getId = () => this.id;

    /**
     * Update the cards label to make it accessible to users with a readspeaker
     *
     * @param {boolean} isMatched The card has been matched
     * @param {boolean} announce Announce the current state of the card
     * @param {boolean} reset Go back to the default label
     */
    this.updateLabel = (isMatched, announce, reset) => {
      // Determine new label from input params
      const imageAlt = alt ? ` ${alt}` : '';

      let label = reset
        ? l10n.cardUnturned
        : `${l10n.cardTurned}${imageAlt}`;

      if (isMatched) {
        label = `${l10n.cardMatched} ${label}`;
      }

      // Update the card's label
      card.setAttribute('aria-label', `${l10n.cardPrefix
        .replace('%num', Array.from(wrapper.parentElement.children).indexOf(wrapper) + 1)
        .replace('%total', cardsTotal)} ${label}`);

      // Update disabled property
      if (reset) {
        card.removeAttribute('aria-disabled');
      }
      else {
        card.setAttribute('aria-disabled', 'true');
      }

      // Announce the label change
      if (announce) {
        card.blur();
        card.focus(); // Announce card label
      }
    };

    /**
     * Flip card.
     *
     * Win 11 screen reader announces image's alt tag even though it never gets
     * focus and button provides aria-label. Therefore alt tag is only set when
     * card is turned.
     * @param {object} [params] Parameters.
     * @param {boolean} [params.restoring] True if card is being restored from a saved state.
     */
    this.flip = (params = {}) => {
      if (flippedState) {
        card.blur();
        card.focus(); // Announce card label again
        return;
      }

      card.classList.add('h5p-flipped');
      cardImage?.setAttribute('alt', alt);
      flippedState = true;

      if (audioPlayer && !params.restoring) {
        audioPlayer.play();
      }

      this.trigger('flip', { restoring: params.restoring });
    };

    /**
     * Flip card back.
     */
    this.flipBack = () => {
      this.stopAudio();
      this.updateLabel(null, null, true); // Reset card label
      card.classList.remove('h5p-flipped');
      cardImage?.setAttribute('alt', '');
      flippedState = false;
    };

    /**
     * Remove.
     */
    this.remove = () => {
      this.stopAudio();
      wrapper.classList.add('h5p-matched');
      removedState = true;
      this.updateAudioButtonState();
    };

    /**
     * Reset card to natural state
     */
    this.reset = () => {
      this.stopAudio();
      this.updateLabel(null, null, true); // Reset card label
      flippedState = false;
      removedState = false;
      wrapper.classList.remove('h5p-matched');
      card.classList.remove('h5p-flipped');
      this.updateAudioButtonState();
    };

    /**
     * Get card description.
     *
     * @returns {string}
     */
    this.getDescription = () => description;

    /**
     * Get image clone.
     *
     * @returns {H5P.jQuery}
     */
    this.getImage = () => $(card.querySelector('img')).clone();

    /**
     * Append card to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    this.appendTo = ($container) => {
      $container[0].appendChild(wrapper);

      card.setAttribute(
        'aria-label',
        `${l10n.cardPrefix
          .replace('%num', Array.from(wrapper.parentElement.children).indexOf(wrapper) + 1)
          .replace('%total', cardsTotal)} ${l10n.cardUnturned}`,
      );
    };

    /**
     * Re-append to parent container.
     */
    this.reAppend = () => {
      const parent = wrapper.parentElement;
      parent.appendChild(wrapper);
    };

    /**
     * Make the card accessible when tabbing
     */
    this.makeTabbable = () => {
      if (card) {
        card.setAttribute('tabindex', '0');
        this.isTabbable = true;
        this.updateAudioButtonState();
      }
    };
    /**
     * Prevent tabbing to the card
    */
    this.makeUntabbable = () => {
      if (card) {
        card.setAttribute('tabindex', '-1');
        this.isTabbable = false;
        this.updateAudioButtonState();
      }
    };

    /**
     * Make card tabbable and move focus to it
     */
    this.setFocus = () => {
      this.makeTabbable();
      if (card) {
        card.focus();
      }
    };

    /**
     * Check if the card has been removed from the game, i.e. if has
     * been matched.
     */
    this.isRemoved = () => removedState ?? false;

    /**
     * Determine whether card is flipped or not.
     * @returns {boolean} True if card is flipped, else false.
     */
    this.isFlipped = () => flippedState ?? false;

    /**
     * Stop any audio track that might be playing.
     */
    this.stopAudio = () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    };

    /**
     * @param {string} label The label to set for the audio button and the tooltip.
     */
    this.toggleAudioButton = (label) => {
      if (audioButton) {
        audioButton.setAttribute('aria-label', label);
        if (audioTooltip) {
          audioTooltip.setText(label);
        }
        else {
          audioTooltip = H5P.Tooltip(audioButton, {
            position: 'top',
            text: label,
          });
        }
      }
    };
    /**
     * Play or stop the audio for the card.
     */
    this.toggleAudio = () => {
      if (card) {
        if (card.classList.contains('h5p-memory-audio-playing')) {
          this.stopAudio();
        }
        else {
          audioPlayer.play();
        }
      }
    };
    this.updateAudioButtonState = () => {
      if (audioButton) {
        if (!flippedState || removedState) {
          audioButton.setAttribute('aria-hidden', 'true');
          audioButton.tabIndex = -1;
        }
        else {
          audioButton.removeAttribute('aria-hidden');
          audioButton.tabIndex = 0;
        }
      }
    };
    this.buildDOM();
  };

  // Extends the event dispatcher
  MemoryGame.Card.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.Card.prototype.constructor = MemoryGame.Card;

  /**
   * Check to see if the given object corresponds with the semantics for
   * a memory game card.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.isValid = function (params) {
    return !!(params?.image?.path || params?.audio);
  };

  /**
   * Checks to see if the card parameters should create cards with different
   * images.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.hasTwoImages = function (params) {
    return !!(params?.match?.path || params?.matchAudio);
  };

  /**
   * Determines the theme for how the cards should look
   *
   * @param {string} backImage The url of the image to put on the back of the cards
   */
  MemoryGame.Card.determineStyles = function (backImage) {
    const styles = {
      front: '',
      back: '',
      backImage: !!backImage,
    };

    // Add back image for card
    if (backImage) {
      const backgroundImage = `background-image:url('${backImage}')`;

      styles.front = ` style="${backgroundImage}"`;
      styles.back = ` style="${backgroundImage}"`;
    }

    return styles;
  };
}(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery));
