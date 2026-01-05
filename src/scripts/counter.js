(function (MemoryGame) {
  /**
   * Keeps track of the number of cards that has been turned
   *
   * @class H5P.MemoryGame.Counter
   * @param {H5P.jQuery} $container
   */
  MemoryGame.Counter = function ($container, startValue = 0) {
    /** @alias H5P.MemoryGame.Counter# */
    const self = this;

    let current = startValue;

    /**
     * @private
     */
    self.update = function () {
      $container[0].innerText = current;
    };

    /**
     * Get current count.
     * @returns {number} Current count.
     */
    self.getCount = () => current;

    /**
     * Increment the counter.
     */
    self.increment = function () {
      current++;
      self.update();
    };

    /**
     * Revert counter back to its natural state
     */
    self.reset = function () {
      current = 0;
      self.update();
    };

    self.update();
  };
}(H5P.MemoryGame));
