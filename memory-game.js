var H5P = H5P || {};

/**
 * H5P Memory Game Module.
 */
H5P.MemoryGame = (function ($) {

  /**
   * Memory Card Constructor
   *
   * @param {Object} parameters
   * @param {Number} id
   */
  function MemoryCard(parameters, id) {
    var self = this;
    var path = H5P.getPath(parameters.path, id);
    var width, height, margin, $card;
    
    var a = 96;
    if (parameters.width !== undefined && parameters.height !== undefined) {
      if (parameters.width > parameters.height) {
        width = a;
        height = parameters.height * (width / parameters.width);
        margin = '' + ((a - height) / 2) + 'px 0 0 0';
      }
      else {
        height = a;
        width = parameters.width * (height / parameters.height);
        margin = '0 0 0 ' + ((a - width) / 2) + 'px';
      }
    }
    else {
      width = height = a;
    }
    
    // Public jQuery wrapper.
    this.$ = $(this);

    /**
     * Public. Flip card.
     */        
    this.flip = function () {
      $card.addClass('h5p-flipped');
    };

    /**
     * Public. Flip card back.
     */    
    this.flipBack = function () {
      $card.removeClass('h5p-flipped');
    }
    
    /**
     * Public. Remove.
     */
    this.remove = function () {
      $card.addClass('h5p-matched');
    }
    
    /**
     * Public. Append card to the given container.
     *
     * @param {jQuery} $container
     */
    this.appendTo = function ($container) {
      $card = $('<li class="h5p-memory-card" role="button" tabindex="1">\
          <div class="h5p-front"></div>\
          <div class="h5p-back">\
            <img src="' + path + '" alt="Memory Card" width="' + width + '" height="' + height + '"' + (margin === undefined ? '' : ' style="margin:' + margin + '"') + '/>\
          </div>\
        </li>')
        .appendTo($container)
        .children('.h5p-front')
          .click(function () {
            self.$.trigger('flip');
          })
          .end();
    };
  };
  
  function MemoryTimer($container) {
    var interval, started;
    
    /**
     * Private. Make timer more readable for humans.
     *
     * @param {Number} seconds
     * @returns {String}
     */
    var humanizeTime = function (seconds) {
      var minutes = Math.floor(seconds / 60);
      var hours = Math.floor(minutes / 60);

      minutes = minutes % 60;
      seconds = Math.floor(seconds % 60);

      var time = '';

      if (hours !== 0) {
        time += hours + ':';

        if (minutes < 10) {
          time += '0';
        }
      }

      time += minutes + ':';

      if (seconds < 10) {
        time += '0';
      }

      time += seconds;

      return time;
    };
    
    /**
     * Private. Update the timer element.
     */
    var update = function () {
      $container.text(humanizeTime(Math.floor(((new Date()).getTime() - started) / 1000)));
    };
    
    /**
     * Public. Starts the counter.
     */
    this.start = function () {
      if (interval === undefined) {
        started = new Date();
        
        interval = setInterval(function () {
          update();
        }, 1000);
      }
    };
    
    /**
     * Public. Stops the counter.
     */
    this.stop = function () {
      if (interval !== undefined) {
        clearInterval(interval);
        update();
      }
    };
  };
  
  /**
   * Memory Counter Constructor
   *
   * @param {jQuery} $container
   */
  function MemoryCounter($container) {
    var current = 0;
    
    this.increment = function () {
      current++;
      $container.text(current);
    };
  }

  /**
   * Memory Game Constructor
   *
   * @param {Object} parameters
   * @param {Number} id
   */
  function MemoryGame(parameters, id) {
    var flipped, timer, counter, $feedback, cards = [], removed = 0;
    
    /**
     * Private. Check if these two cards belongs together.
     *
     * @param {MemoryCard} card
     * @param {MemoryCard} mate
     * @param {MemoryCard} correct
     */
    var check = function (card, mate, correct) {
      if (mate === correct) {
        // Remove them from the game.
        card.remove();
        mate.remove();
        
        removed += 2;
        
        if (removed === cards.length) {
          timer.stop();
          $feedback.addClass('h5p-show');
        }
      }
      else {
        // Flip them back
        card.flipBack();
        mate.flipBack();
      }
    }
    
    /**
     * Private. Adds card to card list and set up a flip listener.
     *
     * @param {MemoryCard} card
     * @param {MemoryCard} mate
     */
    var addCard = function (card, mate) {
      card.$.on('flip', function () {
        // Keep track of time spent
        timer.start();
        
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
    
    // Initialize cards.
    for (var i = 0; i < parameters.cards.length; i++) {
      // Add two of each card
      var cardOne = new MemoryCard(parameters.cards[i], id);
      var cardTwo = new MemoryCard(parameters.cards[i], id);
      addCard(cardOne, cardTwo);
      addCard(cardTwo, cardOne);
    }
    H5P.shuffleArray(cards);
    
    /**
     * Public. Attach this game's html to the given container.
     *
     * @param {jQuery} $container
     */
    this.attach = function ($container) {
      $container.addClass('h5p-memory-game').html('');
      
      // Add cards to list
      var $list = $('<ul/>');
      for (var i = 0; i < cards.length; i++) {
        cards[i].appendTo($list);
      }
      
      if ($list.children().length) {
        $list.appendTo($container);
        
        $feedback = $('<div class="h5p-feedback">' + parameters.l10n.feedback + '</div>').appendTo($container);
        
        // Add status bar
        var $status = $('<dl class="h5p-status">\
             <dt>' + parameters.l10n.timeSpent + '</dt>\
             <dd class="h5p-time-spent">0:00</dd>\
             <dt>' + parameters.l10n.cardTurns + '</dt>\
             <dd class="h5p-card-turns">0</dd>\
           </dl>').appendTo($container);
        
        timer = new MemoryTimer($status.find('.h5p-time-spent'));
        counter = new MemoryCounter($status.find('.h5p-card-turns'));
      }
    };
  };
  
  return MemoryGame;
})(H5P.jQuery);
