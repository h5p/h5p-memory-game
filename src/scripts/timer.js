(function (MemoryGame, Timer) {
  /**
   * Adapter between memory game and H5P.Timer
   *
   * @class H5P.MemoryGame.Timer
   * @extends H5P.Timer
   * @param {Element} element
   */
  MemoryGame.Timer = function (element, startValue = 0) {
    /** @alias H5P.MemoryGame.Timer# */
    const self = this;

    // Initialize event inheritance
    Timer.call(self, 100);
    this.setClockTime(startValue);

    /** @private {string} */
    const naturalState = element.innerText;

    /**
     * Set up callback for time updates.
     * Formats time stamp for humans.
     *
     * @private
     */
    const update = function () {
      const time = self.getTime();

      let hours = Timer.extractTimeElement(time, 'hours');
      let minutes = Timer.extractTimeElement(time, 'minutes');
      let seconds = Timer.extractTimeElement(time, 'seconds') % 60;

      // Update duration attribute
      element.setAttribute('datetime', `PT${hours}H${minutes}M${seconds}S`);

      // Add leading zero
      if (hours < 10) {
        hours = `0${hours}`;
      }
      if (minutes < 10) {
        minutes = `0${minutes}`;
      }
      if (seconds < 10) {
        seconds = `0${seconds}`;
      }

      element.innerText = `${hours}:${minutes}:${seconds}`;
    };

    // Setup default behavior
    self.notify('every_tenth_second', update);
    self.on('reset', () => {
      element.innerText = naturalState;
      self.notify('every_tenth_second', update);
    });

    update();
  };

  // Inheritance
  MemoryGame.Timer.prototype = Object.create(Timer.prototype);
  MemoryGame.Timer.prototype.constructor = MemoryGame.Timer;
}(H5P.MemoryGame, H5P.Timer));
