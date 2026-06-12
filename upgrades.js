var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.MemoryGame'] = (function () {
  return {
    1: {
      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support Memory Game 1.1.
       *
       * Move card images into card object as this allows for additonal
       * properties for each card.
       *
       * @params {object} parameters
       * @params {function} finished
       */
      1: function (parameters, finished) {
        for (var i = 0; i < parameters.cards.length; i++) {
          parameters.cards[i] = {
            image: parameters.cards[i]
          };
        }

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support Memory Game 1.2.
       *
       * Add default behavioural settings for the new options.
       *
       * @params {object} parameters
       * @params {function} finished
       */
      2: function (parameters, finished) {

        parameters.behaviour = {};
        parameters.behaviour.useGrid = false;
        parameters.behaviour.allowRetry = false;

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support Memory Game 1.4.
       *
       * Turns each card into a card pair that holds up to two cards, each
       * with a list of media (image, audio or text). The former
       * image/imageAlt/audio fields become the media of the first card
       * (card1Media). The optional matching match/matchAlt/matchAudio fields
       * become the media of the second card (card2Media), which is only set
       * when the two cards differ.
       *
       * The cards list is also moved into the new "memorygame" group.
       *
       * @params {object} parameters
       * @params {function} finished
       */
      4: function (parameters, finished) {

        /**
         * Build a media list (at most two entries) from an image and/or audio.
         *
         * @params {object} image Image field value.
         * @params {string} alt Alternative text for the image.
         * @params {object} audio Audio field value.
         * @returns {object[]} Media list.
         */
        var buildMedia = function (image, alt, audio) {
          var media = [];

          if (image && image.path) {
            var imageMedia = {
              mediaType: 'image',
              image: image
            };

            if (alt) {
              imageMedia.alt = alt;
            }

            media.push(imageMedia);
          }

          if (audio) {
            media.push({
              mediaType: 'audio',
              audio: audio
            });
          }

          return media;
        };

        if (parameters && parameters.cards) {
          for (var i = 0; i < parameters.cards.length; i++) {
            var card = parameters.cards[i];

            var cardPair = {
              card1Media: buildMedia(card.image, card.imageAlt, card.audio)
            };

            // Only set the second card when it differs from the first one.
            if ((card.match && card.match.path) || card.matchAudio) {
              cardPair.card2Label = true;
              cardPair.card2Media = buildMedia(card.match, card.matchAlt, card.matchAudio);
            }

            if (card.description) {
              cardPair.description = card.description;
            }

            parameters.cards[i] = cardPair;
          }
        }

        // Move the cards list into the new "memorygame" group.
        parameters.memorygame = { cards: parameters.cards ?? [] };
        delete parameters.cards;

        finished(null, parameters);
      }
    }
  };
})();
