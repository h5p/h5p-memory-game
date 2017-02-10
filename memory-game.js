H5P.MemoryGame = (function (EventDispatcher, $) {

  // We don't want to go smaller than 100px per card(including the required margin)
  var CARD_MIN_SIZE = 100; // PX
  var CARD_STD_SIZE = 116; // PX
  var STD_FONT_SIZE = 16; // PX
  var LIST_PADDING = 1; // EMs

  /**
   * Memory Game Constructor
   *
   * @class
   * @param {Object} parameters
   * @param {Number} id
   */
  function MemoryGame(parameters, id) {
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var flipped, timer, counter, popup, $feedback, $wrapper, maxWidth, numCols;
    var cards = [];
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
      if (mate === correct) {
        // Remove them from the game.
        card.remove();
        mate.remove();

        removed += 2;

        var finished = (removed === cards.length);
        var desc = card.getDescription();

        if (finished) {
           self.triggerXAPIScored(1, 1, 'completed');
        }

        if (desc !== undefined) {
          // Pause timer and show desciption.
          timer.pause();
          popup.show(desc, card.getImage(), function () {
            if (finished) {
              // Game has finished
              $feedback.addClass('h5p-show');
              if (parameters.behaviour && parameters.behaviour.allowRetry) { /* TODO */ }
            }
            else {
              // Popup is closed, continue.
              timer.play();
            }
          });
        }
        else if (finished) {
          // Game has finished
          timer.stop();
          $feedback.addClass('h5p-show');
          if (parameters.behaviour && parameters.behaviour.allowRetry) { /* TODO */ }
        }
      }
      else {
        // Flip them back
        card.flipBack();
        mate.flipBack();
      }
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

        if (flipped !== undefined) {
          var matie = flipped;
          // Reset the flipped card.
          flipped = undefined;

          setTimeout(function () {
            check(card, matie, mate);
          }, 800);
        }
        else {
          // Keep track of the flipped card.
          flipped = card;
        }

        // Count number of cards turned
        counter.increment();
      });

      cards.push(card);
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

    // Initialize cards.
    var cardsToUse = getCardsToUse();
    for (var i = 0; i < cardsToUse.length; i++) {
      var cardParams = cardsToUse[i];
      if (MemoryGame.Card.isValid(cardParams)) {
        // Create first card
        var cardTwo, cardOne = new MemoryGame.Card(cardParams.image, id, cardParams.description);

        if (MemoryGame.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new MemoryGame.Card(cardParams.match, id, cardParams.description);
        }
        else {
          // Add two cards with the same image
          cardTwo = new MemoryGame.Card(cardParams.image, id, cardParams.description);
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

        timer = new H5P.Timer(100);
        timer.notify('every_tenth_second', function () {
          var time = timer.getTime();
          var minutes = H5P.Timer.extractTimeElement(time, 'minutes');
          var seconds = H5P.Timer.extractTimeElement(time, 'seconds') % 60;
          if (seconds < 10) {
            seconds = '0' + seconds;
          }
          $status.find('.h5p-time-spent').text(minutes + ':' + seconds);
        });

        counter = new MemoryGame.Counter($status.find('.h5p-card-turns'));
        popup = new MemoryGame.Popup($container);

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
      // due to rounding errors in browsers the margins may vary a bit…
    };

    if (parameters.behaviour && parameters.behaviour.useGrid && cardsToUse.length) {
      self.on('resize', scaleGameSize);
    }
  }

  // Extends the event dispatcher
  MemoryGame.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.prototype.constructor = MemoryGame;

  return MemoryGame;
})(H5P.EventDispatcher, H5P.jQuery);
