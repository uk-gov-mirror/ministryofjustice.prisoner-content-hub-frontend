// eslint-disable-next-line import/no-useless-path-segments
const {
  placeholders: { DEFAULT },
} = require('../../../utils/enums');
const { fullNameOr } = require('../../../utils/string');

class Offender {
  constructor(options = {}) {
    this.bookingId = options.bookingId;
    this.offenderNo = options.offenderNo;
    this.firstName = options.firstName;
    this.lastName = options.lastName;
  }

  format() {
    return {
      bookingId: this.bookingId,
      offenderNo: this.offenderNo,
      name: fullNameOr(DEFAULT, this.firstName, this.lastName),
    };
  }

  static from(response = {}) {
    return new Offender(response);
  }
}

module.exports = {
  Offender,
};
