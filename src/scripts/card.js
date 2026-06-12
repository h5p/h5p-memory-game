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
   * @param {Object} [audio]
   * @param {string} [text] Optional text to show on the card.
   * @param {string} id Unique identifier for card including original+match info.
   */
  MemoryGame.Card = function (image, contentId, cardsTotal, alt, l10n, description, styles, audio, text, id) {
    /** @alias H5P.MemoryGame.Card# */
    const self = this;

    this.id = id;

    // Keep track of tabbable state
    self.isTabbable = false;

    // Initialize event inheritance
    EventDispatcher.call(self);

    let path;
    let $card;
    let $wrapper;
    let $image;
    let removedState;
    let flippedState;
    let audioPlayer;

    /**
     * Process HTML escaped string for use as attribute value,
     * e.g. for alt text or title attributes.
     *
     * @param {string} value
     * @return {string} WARNING! Do NOT use for innerHTML.
     */
    const massageAttributeOutput = (value = l10n.missingDescription) => {
      const dparser = new DOMParser().parseFromString(value, 'text/html');
      const div = document.createElement('div');
      div.innerHTML = dparser.documentElement.textContent;

      return div.textContent || div.innerText;
    };

    self.buildDOM = () => {
      let backContent = '';

      if (text) {
        let media = '';

        if (path) {
          media += `<img src="${path}" alt=""/>`;
        }

        if (audioPlayer) {
          // Button overlapping the image, else a standalone audio button.
          media += path
            ? '<div class="h5p-memory-audio-button"></div>'
            : '<i class="h5p-memory-audio-instead-of-image"></i>';
        }

        const audioText = !path && !!audioPlayer;

        backContent = `<div class="h5p-memory-with-text${audioText ? ' h5p-memory-audio-text' : ''}">`
          + (media ? `<div class="h5p-memory-media">${media}</div>` : '')
          + '<div class="h5p-memory-text"><span></span></div>'
          + '</div>'
          + '<div class="h5p-memory-enlarge-indicator" inert aria-hidden="true"></div>';
      }
      else if (path) {
        backContent = `<img src="${path}" alt=""/>${audioPlayer ? '<div class="h5p-memory-audio-button"></div>' : ''}`;
      }
      else {
        backContent = '<i class="h5p-memory-audio-instead-of-image">';
      }

      $wrapper = $('<li class="h5p-memory-wrap" tabindex="-1" role="button"><div class="h5p-memory-card">'
                  + `<div class="h5p-front"${styles && styles.front ? styles.front : ''}>${styles && styles.backImage ? '' : '<span></span>'}</div>`
                  + `<div class="h5p-back"${styles && styles.back ? styles.back : ''}>${backContent}</div>`
                + '</div></li>');

      // Set via DOM API to avoid HTML injection. Fitting number of lines computed in self.resize() once card has size.
      if (text) {
        $wrapper.find('.h5p-memory-text > span').text(text);
      }

      $wrapper.on('keydown', (event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        switch (event.code) {
          case 'Enter':
          case 'Space':
            if (canEnlarge()) {
              self.trigger('enlarge', { element: $card[0] });
            }
            else {
              self.flip();
            }
            event.preventDefault();
            return;
          case 'ArrowRight':
            // Move focus forward
            self.trigger('next');
            event.preventDefault();
            return;
          case 'ArrowDown':
            // Move focus down
            self.trigger('down');
            event.preventDefault();
            return;
          case 'ArrowLeft':
            // Move focus back
            self.trigger('prev');
            event.preventDefault();
            return;
          case 'ArrowUp': // Up
            // Move focus up
            self.trigger('up');
            event.preventDefault();
            return;
          case 'End':
            // Move to last card
            self.trigger('last');
            event.preventDefault();
            return;
          case 'Home':
            // Move to first card
            self.trigger('first');
            event.preventDefault();
            break;
          default:
            break;
        }
      });

      $image = $wrapper.find('img');

      $card = $wrapper.children('.h5p-memory-card')
        .children('.h5p-front')
        .click((event) => {
          event.stopPropagation();
          self.flip();
        })
        .end();

      if (text || audioPlayer) {
        $card.children('.h5p-back')
          .click(() => {
            if (canEnlarge()) {
              self.trigger('enlarge', { element: $card[0] });
            }
            else if (audioPlayer) {
              if ($card.hasClass('h5p-memory-audio-playing')) {
                self.stopAudio();
              }
              else {
                audioPlayer.play();
              }
            }
          });
      }
    };

    // alt = alt || 'Missing description'; // Default for old games
    alt = massageAttributeOutput(alt);

    // The card's accessible description (used for its aria-label): card's text => image's alt text => generic fallback
    const cardDescription = (text ? massageAttributeOutput(text) : alt) || l10n.missingDescription;

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

        const handlePlaying = function () {
          if ($card) {
            $card.addClass('h5p-memory-audio-playing');
            self.trigger('audioplay');
          }
        };
        const handleStopping = function () {
          if ($card) {
            $card.removeClass('h5p-memory-audio-playing');
            self.trigger('audiostop');
          }
        };
        audioPlayer.addEventListener('play', handlePlaying);
        audioPlayer.addEventListener('ended', handleStopping);
        audioPlayer.addEventListener('pause', handleStopping);
      }
    }

    this.buildDOM();

    /**
     * Get id of the card.
     * @returns {string} The id of the card. (originalIndex-sideNumber)
     */
    this.getId = () => self.id;

    /**
     * Update the cards label to make it accessible to users with a readspeaker
     *
     * @param {boolean} isMatched The card has been matched
     * @param {boolean} announce Announce the current state of the card
     * @param {boolean} reset Go back to the default label
     */
    self.updateLabel = function (isMatched, announce, reset) {
      // Determine new label from input params
      const description = ` ${cardDescription}`;
      let label = reset ? l10n.cardUnturned : `${l10n.cardTurned}${description}`;
      if (isMatched) {
        label = `${l10n.cardMatched} ${label}`;
      }

      // Update the card's label
      $wrapper.attr('aria-label', `${labelPrefix()} ${label}`);

      // Update disabled property
      $wrapper.attr('aria-disabled', reset ? null : 'true');

      // Announce the label change
      if (announce) {
        $wrapper.blur().focus(); // Announce card label
      }
    };

    /**
     * Build "Card X of Y:" prefix shared by the on-board card label and the enlarged dialog label.
     * @returns {string} "Card X of Y:" prefix.
     */
    const labelPrefix = () => l10n.cardPrefix
      .replace('%num', $wrapper.index() + 1)
      .replace('%total', cardsTotal);

    /**
     * Build aria-label for the enlarged dialog.
     * @returns {string} Label for enlarged card.
     */
    self.getEnlargedLabel = () => `${labelPrefix()} ${l10n.cardEnlarged} ${cardDescription}`;

    /**
     * Determine whether card can currently be enlarged.
     * @returns {boolean} True if card can be enlarged, else false.
     */
    const canEnlarge = () => {
      return !!$card
        && $card.hasClass('h5p-memory-text-overflow')
        && !!flippedState && !removedState;
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
    self.flip = function (params = {}) {
      if (flippedState) {
        $wrapper.blur().focus(); // Announce card label again
        return;
      }

      $card.addClass('h5p-flipped');
      $image.attr('alt', alt);
      flippedState = true;

      if (audioPlayer && !params.restoring) {
        audioPlayer.play();
      }

      this.trigger('flip', { restoring: params.restoring });

      // Reveal full text when it does not fit on the card
      if (!params.restoring && !removedState && $card.hasClass('h5p-memory-text-overflow')) {
        const back = $card.children('.h5p-back')[0];
        const openEnlarge = (event) => {
          if (event.target !== back || event.propertyName !== 'transform') {
            return;
          }
          back.removeEventListener('transitionend', openEnlarge);
          self.trigger('enlarge', { element: $card[0] });
        };
        back.addEventListener('transitionend', openEnlarge);
      }
    };

    /**
     * Flip card back.
     */
    self.flipBack = function () {
      self.stopAudio();
      self.updateLabel(null, null, true); // Reset card label
      $card.removeClass('h5p-flipped');
      $image.attr('alt', '');
      flippedState = false;
    };

    /**
     * Remove.
     */
    self.remove = function () {
      $card.addClass('h5p-matched');
      removedState = true;
    };

    /**
     * Reset card to natural state
     */
    self.reset = function () {
      self.stopAudio();
      self.updateLabel(null, null, true); // Reset card label
      flippedState = false;
      removedState = false;
      $card[0].classList.remove('h5p-flipped', 'h5p-matched');
    };

    /**
     * Get card description.
     *
     * @returns {string}
     */
    self.getDescription = function () {
      return description;
    };

    /**
     * Determine whether card has image or text to display
     * @returns {boolean}
     */
    this.hasImageOrText = () => !!path || !!text;

    /**
     * Get clone of card's face as rendered on board, for matched pair popup
     * @returns {HTMLElement} Cloned card element.
     */
    self.getContent = function () {
      const clone = $card[0].cloneNode(true);

      clone.className = 'h5p-memory-card h5p-flipped';
      clone.querySelector('.h5p-front')?.remove();
      clone.querySelector('.h5p-memory-enlarge-indicator')?.remove();

      clone.querySelectorAll('.h5p-memory-audio-button, .h5p-memory-audio-instead-of-image')
        .forEach((icon) => {
          icon.style.visibility = 'hidden';
        });

      return clone;
    };

    /**
     * Get clone of card's text/media content for enlarged popup.
     * @returns {HTMLElement|null} Cloned content, or null if the card has none.
     */
    self.getEnlargedContent = function () {
      const source = $wrapper.find('.h5p-memory-with-text')[0];
      if (!source) {
        return null;
      }

      const clone = source.cloneNode(true);
      clone.querySelectorAll('.h5p-memory-media, .h5p-memory-text').forEach((el) => {
        el.style.flexBasis = '';
      });

      const span = clone.querySelector('.h5p-memory-text > span');
      if (span) {
        span.style.webkitLineClamp = '';
      }

      return clone;
    };

    /**
     * Resize the card's contents.
     */
    self.resize = function () {
      if (!text || !$wrapper) {
        return;
      }

      const box = $wrapper.find('.h5p-memory-text')[0];
      const span = box?.querySelector('span');
      if (!box || !span) {
        return;
      }

      const style = window.getComputedStyle(box);
      const lineHeight = parseFloat(style.lineHeight);
      const paddingTop = parseFloat(style.paddingTop);
      const paddingBottom = parseFloat(style.paddingBottom);

      MemoryGame.Card.distributeAudioText(box.parentElement);

      const available = box.clientHeight - paddingTop - paddingBottom;
      if (!lineHeight || available <= 0) {
        return;
      }

      span.style.webkitLineClamp = `${Math.max(1, Math.floor(available / lineHeight))}`;

      $card.toggleClass('h5p-memory-text-overflow', span.scrollHeight - span.clientHeight > 1);
    };

    /**
     * Append card to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.appendTo = function ($container) {
      $wrapper.appendTo($container);

      $wrapper.attr(
        'aria-label',
        `${l10n.cardPrefix
          .replace('%num', $wrapper.index() + 1)
          .replace('%total', cardsTotal)} ${l10n.cardUnturned}`,
      );
    };

    /**
     * Re-append to parent container.
     */
    self.reAppend = function () {
      const parent = $wrapper[0].parentElement;
      parent.appendChild($wrapper[0]);
    };

    /**
     * Make the card accessible when tabbing
     */
    self.makeTabbable = function () {
      if ($wrapper) {
        $wrapper.attr('tabindex', '0');
        this.isTabbable = true;
      }
    };

    /**
     * Prevent tabbing to the card
     */
    self.makeUntabbable = function () {
      if ($wrapper) {
        $wrapper.attr('tabindex', '-1');
        this.isTabbable = false;
      }
    };

    /**
     * Make card tabbable and move focus to it
     */
    self.setFocus = function () {
      self.makeTabbable();
      if ($wrapper) {
        $wrapper.focus();
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
    self.stopAudio = function () {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    };

    /**
     * Determine whether card has playable audio track.
     * @returns {boolean} True, it card has playable audio track, else false.
     */
    this.hasAudio = () => {
      return !!audioPlayer;
    };

    /**
     * Play the card's audio track, if any.
     */
    this.playAudio = () => {
      if (!audioPlayer) {
        return;
      }

      if (audioPlayer.paused) {
        audioPlayer.currentTime = 0;
      }
      audioPlayer.play();
    };
  };

  // Extends the event dispatcher
  MemoryGame.Card.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.Card.prototype.constructor = MemoryGame.Card;

  /**
   * Distribute available height of audio+text card between its audio and text containers.
   * @param {HTMLElement} layout The `.h5p-memory-with-text` element.
   */
  MemoryGame.Card.distributeAudioText = function (layout) {
    if (!layout || !layout.classList.contains('h5p-memory-audio-text')) {
      return;
    }

    const media = layout.querySelector('.h5p-memory-media');
    const box = layout.querySelector('.h5p-memory-text');
    const span = box?.querySelector('span');
    const audioButton = media?.firstElementChild;
    if (!media || !box || !span || !audioButton) {
      return;
    }

    const layoutStyle = window.getComputedStyle(layout);
    const total = layout.clientHeight - parseFloat(layoutStyle.paddingTop) - parseFloat(layoutStyle.paddingBottom);
    if (total <= 0) {
      return;
    }

    const boxStyle = window.getComputedStyle(box);
    const audioMin = audioButton.offsetHeight;
    const half = total / 2;

    // Height text would need without any line clamping.
    const previousClamp = span.style.webkitLineClamp;
    span.style.webkitLineClamp = 'unset';
    const neededText = span.scrollHeight + parseFloat(boxStyle.paddingTop) + parseFloat(boxStyle.paddingBottom);
    span.style.webkitLineClamp = previousClamp;

    // Keep default split unless text needs more than its half.
    let audioRegion = half;
    if (neededText > half) {
      audioRegion = Math.max(audioMin, total - neededText);
    }

    box.style.flexBasis = `${total - audioRegion}px`;
    media.style.flexBasis = `${audioRegion}px`;
  };

  /**
   * Get the first media of the given type from a card's media list.
   * @param {object[]} media Media list.
   * @param {string} type Media type ('image', 'audio' or 'text').
   * @returns {object|undefined} Matching media entry.
   */
  const getMedia = function (media, type) {
    return (media ?? []).find((entry) => entry?.mediaType === type);
  };

  /**
   * Parse card pair parameters.
   * @param {object} params Card pair parameters.
   * @returns {object} Flattened card parameters.
   */
  MemoryGame.Card.parseParameters = function (params) {
    const image = getMedia(params?.card1Media, 'image');
    const audio = getMedia(params?.card1Media, 'audio');
    const text = getMedia(params?.card1Media, 'text');

    const parsed = {
      image: image?.image,
      imageAlt: image?.alt,
      audio: audio?.audio,
      text: text?.text,
      description: params?.description
    };

    // Second card is only used when it holds its own media.
    if ((params?.card2Media ?? []).length) {
      const matchImage = getMedia(params.card2Media, 'image');
      const matchAudio = getMedia(params.card2Media, 'audio');
      const matchText = getMedia(params.card2Media, 'text');

      parsed.match = matchImage?.image;
      parsed.matchAlt = matchImage?.alt;
      parsed.matchAudio = matchAudio?.audio;
      parsed.matchText = matchText?.text;
    }

    return parsed;
  };

  /**
   * Check to see if the given object corresponds with the semantics for
   * a memory game card.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.isValid = function (params) {
    return !!(params?.image?.path || params?.audio || params?.text);
  };

  /**
   * Checks to see if the card parameters should create cards with different
   * images.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.hasTwoImages = function (params) {
    return !!(params?.match?.path || params?.matchAudio || params?.matchText);
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
