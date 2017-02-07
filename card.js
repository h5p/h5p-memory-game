(function (MemoryGame, EventDispatcher, $) {

  /**
   * Controls all the operations for each card.
   *
   * @class H5P.MemoryGame.Card
   * @param {Object} image
   * @param {number} id
   * @param {string} [description]
   */
  MemoryGame.Card = function (image, id, description) {
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var path = H5P.getPath(image.path, id);
    var width, height, margin, $card;

    if (image.width !== undefined && image.height !== undefined) {
      if (image.width > image.height) {
        width = '100%';
        height = 'auto';
      }
      else {
        height = '100%';
        width = 'auto';
      }
    }
    else {
      width = height = '100%';
    }

    /**
     * Flip card.
     */
    self.flip = function () {
      $card.addClass('h5p-flipped');
      self.trigger('flip');
    };

    /**
     * Flip card back.
     */
    self.flipBack = function () {
      $card.removeClass('h5p-flipped');
    };

    /**
     * Remove.
     */
    self.remove = function () {
      $card.addClass('h5p-matched');
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
     * Get image clone.
     *
     * @returns {H5P.jQuery}
     */
    self.getImage = function () {
      return $card.find('img').clone();
    };

    /**
     * Append card to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.appendTo = function ($container) {
      // TODO: Translate alt attr
      $card = $('<li class="h5p-memory-wrap"><div class="h5p-memory-card" role="button" tabindex="1">' +
                  '<div class="h5p-front"></div>' +
                  '<div class="h5p-back">' +
                    '<img src="' + path + '" alt="Memory Card" style="width:' + width + ';height:' + height + '"/>' +
                  '</div>' +
                '</div></li>')
        .appendTo($container)
        .children('.h5p-memory-card')
          .children('.h5p-front')
            .click(function () {
              self.flip();
            })
            .end();
      };
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
    return (params !== undefined &&
            params.image !== undefined &&
            params.image.path !== undefined);
  };

  /**
   * Checks to see if the card parameters should create cards with different
   * images.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.hasTwoImages = function (params) {
    return (params !== undefined &&
            params.match !== undefined &&
            params.match.path !== undefined);
  };

})(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery);
