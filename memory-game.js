H5P.MemoryGame = (function (EventDispatcher, $) {

  // We don't want to go smaller than 100px per card(including the required margin)
  var CARD_MIN_SIZE = 100; // PX
  var CARD_STD_SIZE = 116; // PX
  var STD_FONT_SIZE = 16; // PX
  var LIST_PADDING = 1; // EMs

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

    var flipped, timer, counter, popup, $feedback, $wrapper, maxWidth, numCols;
    var cards = [];
    var flipBacks = []; // Que of cards to be flipped back
    var numFlipped = 0;
    var removed = 0;

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

        // Wait for next click to flip them back…
        if (numFlipped > 2) {
          // or do it straight away
          processFlipBacks();
        }
        return;
      }

      // Remove them from the game.
      card.remove();
      mate.remove();

      // Update counters
      numFlipped -= 2;
      removed += 2;

      var isFinished = (removed === cards.length);
      var desc = card.getDescription();

      if (desc !== undefined) {
        // Pause timer and show desciption.
        timer.pause();
        var imgs = [card.getImage()];
        if (card.hasTwoImages) {
          imgs.push(mate.getImage());
        }
        popup.show(desc, imgs, cardStyles ? cardStyles.back : undefined, function () {
          if (isFinished) {
            // Game done
            finished();
          }
          else {
            // Popup is closed, continue.
            timer.play();
          }
        });
      }
      else if (isFinished) {
        // Game done
        finished();
      }
    };

    /**
     * Game has finished!
     * @private
     */
    var finished = function () {
      timer.stop();
      $feedback.addClass('h5p-show');

      // Create and trigger xAPI event 'completed'
      var completedEvent = self.createXAPIEventTemplate('completed');
      completedEvent.setScoredResult(1, 1, self, true, true);
      completedEvent.data.statement.result.duration = 'PT' + (Math.round(timer.getTime() / 10) / 100) + 'S';
      self.trigger(completedEvent);

      if (parameters.behaviour && parameters.behaviour.allowRetry) {
        // Create retry button
        var retryButton = createButton('reset', parameters.l10n.tryAgain || 'Reset', function () {
          // Trigger handler (action)

          retryButton.classList.add('h5p-memory-transout');
          setTimeout(function () {
            // Remove button on nextTick to get transition effect
            $wrapper[0].removeChild(retryButton);
          }, 300);

          resetGame();
        });
        retryButton.classList.add('h5p-memory-transin');
        setTimeout(function () {
          // Remove class on nextTick to get transition effect
          retryButton.classList.remove('h5p-memory-transin');
        }, 0);

        // Same size as cards
        retryButton.style.fontSize = (parseFloat($wrapper.children('ul')[0].style.fontSize) * 0.75) + 'px';

        $wrapper[0].appendChild(retryButton); // Add to DOM
      }
    };

    /**
     * Shuffle the cards and restart the game!
     * @private
     */
    var resetGame = function () {

      // Reset cards
      removed = 0;
      for (var i = 0; i < cards.length; i++) {
        cards[i].reset();
      }

      // Remove feedback
      $feedback[0].classList.remove('h5p-show');

      // Reset timer and counter
      timer.reset();
      counter.reset();

      // Randomize cards
      H5P.shuffleArray(cards);

      setTimeout(function () {
        // Re-append to DOM after flipping back
        for (var i = 0; i < cards.length; i++) {
          cards[i].reAppend();
        }

        // Scale new layout
        $wrapper.children('ul').children('.h5p-row-break').removeClass('h5p-row-break');
        maxWidth = -1;
        self.trigger('resize');
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
      buttonElement.addEventListener('click', function (event) {
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
        self.triggerXAPI('interacted');
        // Keep track of time spent
        timer.play();

        // Keep track of the number of flipped cards
        numFlipped++;

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
        var cardTwo, cardOne = new MemoryGame.Card(cardParams.image, id, cardParams.description, cardStyles);

        if (MemoryGame.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new MemoryGame.Card(cardParams.match, id, cardParams.description, cardStyles);
          cardOne.hasTwoImages = cardTwo.hasTwoImages = true;
        }
        else {
          // Add two cards with the same image
          cardTwo = new MemoryGame.Card(cardParams.image, id, cardParams.description, cardStyles);
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
      var $list = $('<ul/>');
      for (var i = 0; i < cards.length; i++) {
        cards[i].appendTo($list);
      }

      if ($list.children().length) {
        $list.appendTo($container);

        $feedback = $('<div class="h5p-feedback">' + parameters.l10n.feedback + '</div>').appendTo($container);

        // Add status bar
        var $status = $('<dl class="h5p-status">' +
                        '<dt>' + parameters.l10n.timeSpent + '</dt>' +
                        '<dd class="h5p-time-spent">0:00</dd>' +
                        '<dt>' + parameters.l10n.cardTurns + '</dt>' +
                        '<dd class="h5p-card-turns">0</dd>' +
                        '</dl>').appendTo($container);

        timer = new MemoryGame.Timer($status.find('.h5p-time-spent')[0]);
        counter = new MemoryGame.Counter($status.find('.h5p-card-turns'));
        popup = new MemoryGame.Popup($container, parameters.l10n);

        $container.click(function () {
          popup.close();
        });
      }
    };

    /**
     * Will try to scale the game so that it fits within its container.
     * Puts the cards into a grid layout to make it as square as possible – 
     * which improves the playability on multiple devices.
     *
     * @private
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
          if (i === numCols) {
            $(e).addClass('h5p-row-break');
          }
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

    if (parameters.behaviour && parameters.behaviour.useGrid && cardsToUse.length) {
      self.on('resize', scaleGameSize);
    }
  }

  // Extends the event dispatcher
  MemoryGame.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.prototype.constructor = MemoryGame;

  /**
   * Determine color contrast level compared to white(#fff)
   *
   * @private
   * @param {string} color hex code
   * @return {number} From 1 to Infinity.
   */
  var getContrast = function (color) {
    return 255 / ((parseInt(color.substr(1, 2), 16) * 299 +
                   parseInt(color.substr(3, 2), 16) * 587 +
                   parseInt(color.substr(5, 2), 16) * 144) / 1000);
  };

  return MemoryGame;
})(H5P.EventDispatcher, H5P.jQuery);
