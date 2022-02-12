var ko = require('knockout');

class Selectable {
  constructor(graph) {
    this.selected = ko.computed({
      read() {
        return graph.currentActionContext() == this;
      },
      write(val) {
        const valConstructorName = ((val || {}).constructor || {}).name;
        const thisConstructorName = ((val || {}).constructor || {}).name;
        ungit.logger.debug('>>>>581', typeof val, val === this);
        ungit.logger.debug('>>>>888', valConstructorName, thisConstructorName);
        // val is this if we're called from a click ko binding
        if (val === this || val === true) {
          graph.currentActionContext(this);
        } else if (graph.currentActionContext() == this) {
          graph.currentActionContext(null);
        }
      },
      owner: this,
    });
  }
}
module.exports = Selectable;
