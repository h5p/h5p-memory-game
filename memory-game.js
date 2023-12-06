H5P.MemoryGame = (function (EventDispatcher, $) {

  // We don't want to go smaller than 100px per card(including the required margin)
  var CARD_MIN_SIZE = 100; // PX
  var CARD_STD_SIZE = 116; // PX
  var STD_FONT_SIZE = 16; // PX
  var LIST_PADDING = 1; // EMs
  var numInstances = 0;

  /**
   * Memory Game Constructor
   *
   * @class H5P.MemoryGame
   * @extends H5P.EventDispatcher
   * @param {Object} parameters
   * @param {Number} id
   */
  function MemoryGame(parameters, id) {
    /** @alias H5P.MemoryGame# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var flipped, timer, counter, popup, $bottom, $taskComplete, $feedback, $wrapper, maxWidth, numCols, audioCard;
    var cards = [];
    var flipBacks = []; // Que of cards to be flipped back
    var numFlipped = 0;
    var removed = 0;
    var score = 0;
    numInstances++;

    // Add defaults
    parameters = $.extend(true, {
      l10n: {
        cardTurns: 'Card turns',
        timeSpent: 'Time spent',
        feedback: 'Good work!',
        tryAgain: 'Reset',
        closeLabel: 'Close',
        label: 'Memory Game. Find the matching cards.',
        labelInstructions: 'Use arrow keys left and right to navigate cards. Use space or enter key to turn card.',
        done: 'All of the cards have been found.',
        cardPrefix: 'Card %num of %total:',
        cardUnturned: 'Unturned. Click to turn.',
        cardTurned: 'Turned.',
        cardMatched: 'Match found.',
        cardMatchedA11y: 'Your cards match!',
        cardNotMatchedA11y: 'Your chosen cards do not match. Turn other cards to try again.'
      }
    }, parameters);

    /**
     * Check if these two cards belongs together.
     *
     * @private
     * @param {H5P.MemoryGame.Card} card
     * @param {H5P.MemoryGame.Card} mate
     * @param {H5P.MemoryGame.Card} correct
     */
    var check = function (card, mate, correct) {
      if (mate !== correct) {
        // Incorrect, must be scheduled for flipping back
        flipBacks.push(card);
        flipBacks.push(mate);

        ariaLiveRegion.read(parameters.l10n.cardNotMatchedA11y);

        // Wait for next click to flip them back…
        if (numFlipped > 2) {
          // or do it straight away
          processFlipBacks();
        }
        return;
      }

      // Update counters
      numFlipped -= 2;
      removed += 2;

      var isFinished = (removed === cards.length);

      // Remove them from the game.
      card.remove(!isFinished);
      mate.remove();

      var desc = card.getDescription();
      if (desc !== undefined) {
        // Pause timer and show desciption.
        timer.pause();
        var imgs = [card.getImage()];
        if (card.hasTwoImages) {
          imgs.push(mate.getImage());
        }

        // Keep message for dialog modal shorter without instructions
        $applicationLabel.html(parameters.l10n.label);

        popup.show(desc, imgs, cardStyles ? cardStyles.back : undefined, function (refocus) {
          if (isFinished) {
            // Game done
            card.makeUntabbable();
            finished();
          }
          else {
            // Popup is closed, continue.
            timer.play();

            if (refocus) {
              card.setFocus();
            }
          }
        });
      }
      else if (isFinished) {
        // Game done
        card.makeUntabbable();
        finished();
      }
    };

    /**
     * Game has finished!
     * @private
     */
    var finished = function () {
      timer.stop();
      $taskComplete.show();
      $feedback.addClass('h5p-show'); // Announce
      setTimeout(function () {
        $bottom.focus();
      }, 0); // Give closing dialog modal time to free screen reader
      score = 1;

      self.trigger(self.createXAPICompletedEvent());

      if (parameters.behaviour && parameters.behaviour.allowRetry) {
        // Create retry button
        self.retryButton = createButton('reset', parameters.l10n.tryAgain || 'Reset', function () {
          self.resetTask(true);
        });
        self.retryButton.classList.add('h5p-memory-transin');
        setTimeout(function () {
          // Remove class on nextTick to get transition effectupd
          self.retryButton.classList.remove('h5p-memory-transin');
        }, 0);

        // Same size as cards
        self.retryButton.style.fontSize = (parseFloat($wrapper.children('ul')[0].style.fontSize) * 0.75) + 'px';

        $wrapper[0].appendChild(self.retryButton); // Add to DOM
      }
    };

    /**
     * Remove retry button.
     * @private
     */
    const removeRetryButton = function () {
      if (!self.retryButton || self.retryButton.parentNode !== $wrapper[0]) {
        return; // Button not defined or attached to wrapper
      }

      self.retryButton.classList.add('h5p-memory-transout');
      setTimeout(function () {
        // Remove button on nextTick to get transition effect
        $wrapper[0].removeChild(self.retryButton);
      }, 300);
    };

    /**
     * Shuffle the cards and restart the game!
     * @private
     */
    var resetGame = function (moveFocus = false) {
      // Reset cards
      removed = 0;
      score = 0;
      flipped = undefined;
      numFlipped = 0;

      // Remove feedback
      $feedback[0].classList.remove('h5p-show');
      $taskComplete.hide();

      popup.close();

      // Reset timer and counter
      timer.stop();
      timer.reset();
      counter.reset();

      // Randomize cards
      H5P.shuffleArray(cards);

      setTimeout(function () {
        // Re-append to DOM after flipping back
        for (var i = 0; i < cards.length; i++) {
          cards[i].reAppend();
        }
        for (var j = 0; j < cards.length; j++) {
          cards[j].reset();
        }

        // Scale new layout
        $wrapper.children('ul').children('.h5p-row-break').removeClass('h5p-row-break');
        maxWidth = -1;
        self.trigger('resize');
        moveFocus && cards[0].setFocus();
      }, 600);
    };

    /**
     * Game has finished!
     * @private
     */
    var createButton = function (name, label, action) {
      var buttonElement = document.createElement('div');
      buttonElement.classList.add('h5p-memory-' + name);
      buttonElement.innerHTML = label;
      buttonElement.setAttribute('role', 'button');
      buttonElement.tabIndex = 0;
      buttonElement.addEventListener('click', function () {
        action.apply(buttonElement);
      }, false);
      buttonElement.addEventListener('keypress', function (event) {
        if (event.which === 13 || event.which === 32) { // Enter or Space key
          event.preventDefault();
          action.apply(buttonElement);
        }
      }, false);
      return buttonElement;
    };

    /**
     * Adds card to card list and set up a flip listener.
     *
     * @private
     * @param {H5P.MemoryGame.Card} card
     * @param {H5P.MemoryGame.Card} mate
     */
    var addCard = function (card, mate) {
      card.on('flip', function () {
        if (audioCard) {
          audioCard.stopAudio();
        }

        // Always return focus to the card last flipped
        for (var i = 0; i < cards.length; i++) {
          cards[i].makeUntabbable();
        }
        card.makeTabbable();

        popup.close();
        self.triggerXAPI('interacted');
        // Keep track of time spent
        timer.play();

        // Keep track of the number of flipped cards
        numFlipped++;

        // Announce the card unless it's the last one and it's correct
        var isMatched = (flipped === mate);
        var isLast = ((removed + 2) === cards.length);
        card.updateLabel(isMatched, !(isMatched && isLast));

        if (flipped !== undefined) {
          var matie = flipped;
          // Reset the flipped card.
          flipped = undefined;

          setTimeout(function () {
            check(card, matie, mate);
          }, 800);
        }
        else {
          if (flipBacks.length > 1) {
            // Turn back any flipped cards
            processFlipBacks();
          }

          // Keep track of the flipped card.
          flipped = card;
        }

        // Count number of cards turned
        counter.increment();
      });
      card.on('audioplay', function () {
        if (audioCard) {
          audioCard.stopAudio();
        }
        audioCard = card;
      });
      card.on('audiostop', function () {
        audioCard = undefined;
      });

      /**
       * Create event handler for moving focus to next available card i
       * given direction.
       *
       * @private
       * @param {number} direction Direction code, see MemoryGame.DIRECTION_x.
       * @return {function} Focus handler.
       */
      var createCardChangeFocusHandler = function (direction) {
        return function () {

          // Get current card index
          const currentIndex = cards.map(function (card) {
            return card.isTabbable;
          }).indexOf(true);

          if (currentIndex === -1) {
            return; // No tabbable card found
          }

          // Skip cards that have already been removed from the game
          let adjacentIndex = currentIndex;
          do {
            adjacentIndex = getAdjacentCardIndex(adjacentIndex, direction);
          }
          while (adjacentIndex !== null && cards[adjacentIndex].isRemoved());

          if (adjacentIndex === null) {
            return; // No card available in that direction
          }

          // Move focus
          cards[currentIndex].makeUntabbable();
          cards[adjacentIndex].setFocus();
        };
      };

      // Register handlers for moving focus in given direction
      card.on('up', createCardChangeFocusHandler(MemoryGame.DIRECTION_UP));
      card.on('next', createCardChangeFocusHandler(MemoryGame.DIRECTION_RIGHT));
      card.on('down', createCardChangeFocusHandler(MemoryGame.DIRECTION_DOWN));
      card.on('prev', createCardChangeFocusHandler(MemoryGame.DIRECTION_LEFT));

      /**
       * Create event handler for moving focus to the first or the last card
       * on the table.
       *
       * @private
       * @param {number} direction +1/-1
       * @return {function}
       */
      var createEndCardFocusHandler = function (direction) {
        return function () {
          var focusSet = false;
          for (var i = 0; i < cards.length; i++) {
            var j = (direction === -1 ? cards.length - (i + 1) : i);
            if (!focusSet && !cards[j].isRemoved()) {
              cards[j].setFocus();
              focusSet = true;
            }
            else if (cards[j] === card) {
              card.makeUntabbable();
            }
          }
        };
      };

      // Register handlers for moving focus to first and last card
      card.on('first', createEndCardFocusHandler(1));
      card.on('last', createEndCardFocusHandler(-1));

      cards.push(card);
    };

    /**
     * Will flip back two and two cards
     */
    var processFlipBacks = function () {
      flipBacks[0].flipBack();
      flipBacks[1].flipBack();
      flipBacks.splice(0, 2);
      numFlipped -= 2;
    };

    /**
     * @private
     */
    var getCardsToUse = function () {
      var numCardsToUse = (parameters.behaviour && parameters.behaviour.numCardsToUse ? parseInt(parameters.behaviour.numCardsToUse) : 0);
      if (numCardsToUse <= 2 || numCardsToUse >= parameters.cards.length) {
        // Use all cards
        return parameters.cards;
      }

      // Pick random cards from pool
      var cardsToUse = [];
      var pickedCardsMap = {};

      var numPicket = 0;
      while (numPicket < numCardsToUse) {
        var pickIndex = Math.floor(Math.random() * parameters.cards.length);
        if (pickedCardsMap[pickIndex]) {
          continue; // Already picked, try again!
        }

        cardsToUse.push(parameters.cards[pickIndex]);
        pickedCardsMap[pickIndex] = true;
        numPicket++;
      }

      return cardsToUse;
    };

    var cardStyles, invertShades;
    if (parameters.lookNFeel) {
      // If the contrast between the chosen color and white is too low we invert the shades to create good contrast
      invertShades = (parameters.lookNFeel.themeColor &&
                      getContrast(parameters.lookNFeel.themeColor) < 1.7 ? -1 : 1);
      var backImage = (parameters.lookNFeel.cardBack ? H5P.getPath(parameters.lookNFeel.cardBack.path, id) : null);
      cardStyles = MemoryGame.Card.determineStyles(parameters.lookNFeel.themeColor, invertShades, backImage);
    }

    // Initialize cards.
    var cardsToUse = getCardsToUse();
    for (var i = 0; i < cardsToUse.length; i++) {
      var cardParams = cardsToUse[i];
      if (MemoryGame.Card.isValid(cardParams)) {
        // Create first card
        var cardTwo, cardOne = new MemoryGame.Card(cardParams.image, id, 2 * cardsToUse.length, cardParams.imageAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.audio);

        if (MemoryGame.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new MemoryGame.Card(cardParams.match, id, 2 * cardsToUse.length, cardParams.matchAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.matchAudio);
          cardOne.hasTwoImages = cardTwo.hasTwoImages = true;
        }
        else {
          // Add two cards with the same image
          cardTwo = new MemoryGame.Card(cardParams.image, id, 2 * cardsToUse.length, cardParams.imageAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.audio);
        }

        // Add cards to card list for shuffeling
        addCard(cardOne, cardTwo);
        addCard(cardTwo, cardOne);
      }
    }
    H5P.shuffleArray(cards);

    /**
     * Attach this game's html to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {
      this.triggerXAPI('attempted');
      // TODO: Only create on first attach!
      $wrapper = $container.addClass('h5p-memory-game').html('');
      if (invertShades === -1) {
        $container.addClass('h5p-invert-shades');
      }

      // Add cards to list
      var $list = $('<ul/>', {
        role: 'application',
        'aria-labelledby': 'h5p-intro-' + numInstances
      });
      for (var i = 0; i < cards.length; i++) {
        cards[i].appendTo($list);
      }

      if ($list.children().length) {
        cards[0].makeTabbable();

        $applicationLabel = $('<div/>', {
          id: 'h5p-intro-' + numInstances,
          'class': 'h5p-memory-hidden-read',
          html: parameters.l10n.label + ' ' + parameters.l10n.labelInstructions,
          appendTo: $container
        });
        $list.appendTo($container);

        $bottom = $('<div/>', {
          'class': 'h5p-programatically-focusable',
          tabindex: '-1',
          appendTo: $container
        });
        $taskComplete = $('<div/>', {
          'class': 'h5p-memory-complete h5p-memory-hidden-read',
          html: parameters.l10n.done,
          appendTo: $bottom
        });

        $feedback = $('<div class="h5p-feedback">' + parameters.l10n.feedback + '</div>').appendTo($bottom);

        // Add status bar
        var $status = $('<dl class="h5p-status">' +
                        '<dt>' + parameters.l10n.timeSpent + ':</dt>' +
                        '<dd class="h5p-time-spent"><time role="timer" datetime="PT0M0S">0:00</time><span class="h5p-memory-hidden-read">.</span></dd>' +
                        '<dt>' + parameters.l10n.cardTurns + ':</dt>' +
                        '<dd class="h5p-card-turns">0<span class="h5p-memory-hidden-read">.</span></dd>' +
                        '</dl>').appendTo($bottom);

        timer = new MemoryGame.Timer($status.find('time')[0]);
        counter = new MemoryGame.Counter($status.find('.h5p-card-turns'));
        popup = new MemoryGame.Popup($container, parameters.l10n);

        popup.on('closed', function () {
          // Add instructions back
          $applicationLabel.html(parameters.l10n.label + ' ' + parameters.l10n.labelInstructions);
        });

        // Aria live region to politely read to screen reader
        ariaLiveRegion = new MemoryGame.AriaLiveRegion();
        $container.append(ariaLiveRegion.getDOM());

        $container.click(function () {
          popup.close();
        });
      }
      else {
        const $foo = $('<div/>')
          .text('No card was added to the memory game!')
          .appendTo($list);

        $list.appendTo($container);
      }

      self.attached = true;
    };

    /**
     * Will try to scale the game so that it fits within its container.
     * Puts the cards into a grid layout to make it as square as possible –
     * which improves the playability on multiple devices.
     *
     * @private
     */
    var scaleGameSize = function () {

      // Check how much space we have available
      var $list = $wrapper.children('ul');

      var newMaxWidth = parseFloat(window.getComputedStyle($list[0]).width);
      if (maxWidth === newMaxWidth) {
        return; // Same size, no need to recalculate
      }
      else {
        maxWidth = newMaxWidth;
      }

      // Get the card holders
      var $elements = $list.children();
      if ($elements.length < 4) {
        return; // No need to proceed
      }

      // Determine the optimal number of columns
      var newNumCols = Math.ceil(Math.sqrt($elements.length));

      // Do not exceed the max number of columns
      var maxCols = Math.floor(maxWidth / CARD_MIN_SIZE);
      if (newNumCols > maxCols) {
        newNumCols = maxCols;
      }

      if (numCols !== newNumCols) {
        // We need to change layout
        numCols = newNumCols;

        // Calculate new column size in percentage and round it down (we don't
        // want things sticking out…)
        var colSize = Math.floor((100 / numCols) * 10000) / 10000;
        $elements.css('width', colSize + '%').each(function (i, e) {
          $(e).toggleClass('h5p-row-break', i === numCols);
        });
      }

      // Calculate how much one percentage of the standard/default size is
      var onePercentage = ((CARD_STD_SIZE * numCols) + STD_FONT_SIZE) / 100;
      var paddingSize = (STD_FONT_SIZE * LIST_PADDING) / onePercentage;
      var cardSize = (100 - paddingSize) / numCols;
      var fontSize = (((maxWidth * (cardSize / 100)) * STD_FONT_SIZE) / CARD_STD_SIZE);

      // We use font size to evenly scale all parts of the cards.
      $list.css('font-size', fontSize + 'px');
      popup.setSize(fontSize);
      // due to rounding errors in browsers the margins may vary a bit…
    };

    /**
     * Get index of adjacent card.
     *
     * @private
     * @param {number} currentIndex Index of card to check adjacent card for.
     * @param {number} direction Direction code, cmp. MemoryGame.DIRECTION_x.
     * @returns {number|null} Index of adjacent card or null if not retrievable.
     */
    const getAdjacentCardIndex = function (currentIndex, direction) {
      if (
        typeof currentIndex !== 'number' ||
        currentIndex < 0 || currentIndex > cards.length - 1 ||
        (
          direction !== MemoryGame.DIRECTION_UP &&
          direction !== MemoryGame.DIRECTION_RIGHT &&
          direction !== MemoryGame.DIRECTION_DOWN &&
          direction !== MemoryGame.DIRECTION_LEFT
        )
      ) {
        return null; // Parameters not valid
      }

      let adjacentIndex = null;

      if (direction === MemoryGame.DIRECTION_LEFT) {
        adjacentIndex = currentIndex - 1;
      }
      else if (direction === MemoryGame.DIRECTION_RIGHT) {
        adjacentIndex = currentIndex + 1;
      }
      else if (direction === MemoryGame.DIRECTION_UP) {
        adjacentIndex = currentIndex - numCols;
      }
      else if (direction === MemoryGame.DIRECTION_DOWN) {
        adjacentIndex = currentIndex + numCols;
      }

      return (adjacentIndex >= 0 && adjacentIndex < cards.length) ?
        adjacentIndex :
        null; // Out of bounds
    }

    if (parameters.behaviour && parameters.behaviour.useGrid && cardsToUse.length) {
      self.on('resize', scaleGameSize);
    }

    /**
     * Get the user's score for this task.
     *
     * @returns {Number} The current score.
     */
    self.getScore = function () {
      return score;
    };

    /**
     * Get the maximum score for this task.
     *
     * @returns {Number} The maximum score.
     */
    self.getMaxScore = function () {
      return 1;
    };

    /**
     * Create a 'completed' xAPI event object.
     *
     * @returns {Object} xAPI completed event
     */
    self.createXAPICompletedEvent = function () {
      var completedEvent = self.createXAPIEventTemplate('completed');
      completedEvent.setScoredResult(self.getScore(), self.getMaxScore(), self, true, true);
      completedEvent.data.statement.result.duration = 'PT' + (Math.round(timer.getTime() / 10) / 100) + 'S';
      return completedEvent;
    }

    /**
     * Contract used by report rendering engine.
     *
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     *
     * @returns {Object} xAPI data
     */
    self.getXAPIData = function () {
      var completedEvent = self.createXAPICompletedEvent();
      return {
        statement: completedEvent.data.statement
      };
    };

    /**
     * Reset task.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
     */
    self.resetTask = function (moveFocus = false) {
      if (self.attached) {
        removeRetryButton();
        resetGame(moveFocus);
      }
    };
  }

  // Extends the event dispatcher
  MemoryGame.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.prototype.constructor = MemoryGame;

  /** @constant {number} DIRECTION_UP Code for up. */
  MemoryGame.DIRECTION_UP = 0;

  /** @constant {number} DIRECTION_LEFT Code for left. Legacy value. */
  MemoryGame.DIRECTION_LEFT = -1;

  /** @constant {number} DIRECTION_DOWN Code for down. */
  MemoryGame.DIRECTION_DOWN = 2;

  /** @constant {number} DIRECTION_DOWN Code for right. Legacy value. */
  MemoryGame.DIRECTION_RIGHT = 1

  /**
   * Determine color contrast level compared to white(#fff)
   *
   * @private
   * @param {string} color hex code
   * @return {number} From 1 to Infinity.
   */
  var getContrast = function (color) {
    return 255 / ((parseInt(color.substring(1, 3), 16) * 299 +
                   parseInt(color.substring(3, 5), 16) * 587 +
                   parseInt(color.substring(5, 7), 16) * 144) / 1000);
  };

  return MemoryGame;
})(H5P.EventDispatcher, H5P.jQuery);
