(function (MemoryGame, EventDispatcher, $) {

  /**
   * Controls all the operations for each card.
   *
   * @class H5P.MemoryGame.Card
   * @extends H5P.EventDispatcher
   * @param {Object} image
   * @param {number} id
   * @param {string} [description]
   * @param {Object} [styles]
   */
  MemoryGame.Card = function (image, id, description, styles) {
    /** @alias H5P.MemoryGame.Card# */
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
     * Reset card to natural state
     */
    self.reset = function () {
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
                  '<div class="h5p-front"' + (styles && styles.front ? styles.front : '') + '>' + (styles.backImage ? '' : '<span></span>') + '</div>' +
                  '<div class="h5p-back"' + (styles && styles.back ? styles.back : '') + '>' +
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

    /**
     * Re-append to parent container
     */
    self.reAppend = function () {
      var parent = $card[0].parentElement.parentElement;
      parent.appendChild($card[0].parentElement);
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

  /**
   * Determines the theme for how the cards should look
   *
   * @param {string} color The base color selected
   * @param {number} invertShades Factor used to invert shades in case of bad contrast
   */
  MemoryGame.Card.determineStyles = function (color, invertShades, backImage) {
    var styles =  {
      front: '',
      back: '',
      backImage: !!backImage
    };

    // Create color theme
    if (color) {
      var frontColor = shade(color, 43.75 * invertShades);
      var backColor = shade(color, 56.25 * invertShades);

      styles.front += 'color:' + color + ';' +
                     'background-color:' + frontColor + ';' +
                     'border-color:' + frontColor +';';
      styles.back += 'color:' + color + ';' +
                    'background-color:' + backColor + ';' +
                    'border-color:' + frontColor +';';
    }

    // Add back image for card
    if (backImage) {
      var backgroundImage = 'background-image:url(' + backImage + ')';

      styles.front += backgroundImage;
      styles.back += backgroundImage;
    }

    // Prep style attribute
    if (styles.front) {
      styles.front = ' style="' + styles.front + '"';
    }
    if (styles.back) {
      styles.back = ' style="' + styles.back + '"';
    }

    return styles;
  };

  /**
   * Convert hex color into shade depending on given percent
   *
   * @private
   * @param {string} color
   * @param {number} percent
   * @return {string} new color
   */
  var shade = function (color, percent) {
    var newColor = '#';

    // Determine if we should lighten or darken
    var max = (percent < 0 ? 0 : 255);

    // Always stay positive
    if (percent < 0) {
      percent *= -1;
    }
    percent /= 100;

    for (var i = 1; i < 6; i += 2) {
      // Grab channel and convert from hex to dec
      var channel = parseInt(color.substr(i, 2), 16);

      // Calculate new shade and convert back to hex
      channel = (Math.round((max - channel) * percent) + channel).toString(16);

      // Make sure to always use two digits
      newColor += (channel.length < 2 ? '0' + channel : channel);
    }

    return newColor;
  };

})(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery);
